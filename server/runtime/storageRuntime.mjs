import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

const STORAGE_PROVIDERS = new Set(["not-configured", "local-dev", "supabase-storage", "s3-compatible"]);

export function resolveStorageConfig(env = process.env) {
  const provider = String(env.STORAGE_PROVIDER || "not-configured").trim().toLowerCase();
  const normalizedProvider = STORAGE_PROVIDERS.has(provider) ? provider : "not-configured";
  return {
    provider: normalizedProvider,
    bucket: env.STORAGE_BUCKET_DOCUMENTS || "constriqo-documents",
    isExternal: normalizedProvider === "supabase-storage" || normalizedProvider === "s3-compatible",
    localRoot: env.LOCAL_STORAGE_ROOT || ".local-data/storage",
  };
}

export function buildGeneratedStorageKey(input, env = process.env) {
  const config = resolveStorageConfig(env);
  const tenantId = safePath(input.tenantId);
  const documentType = safePath(input.documentType || "document");
  const entityType = safePath(input.relatedEntityType || "entity");
  const entityId = safePath(input.relatedEntityId || "unknown");
  const filename = safeFilename(input.filename || `${entityId}.pdf`);
  const path = `${tenantId}/generated/${documentType}/${entityType}/${entityId}/${filename}`;

  if (config.provider === "supabase-storage") {
    return `supabase://${config.bucket}/${path}`;
  }
  if (config.provider === "s3-compatible") {
    return `s3://${config.bucket}/${path}`;
  }
  if (config.provider === "local-dev") {
    return `local-dev://${config.bucket}/${path}`;
  }
  return `generated://${documentType}/${entityType}/${entityId}/${filename}`;
}

export async function storeGeneratedDocumentBuffer(document, buffer, options = {}) {
  const env = options.env || process.env;
  const contentType = options.contentType || "application/pdf";
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || "");
  const checksumSha256 = createHash("sha256").update(data).digest("hex");
  const storageKey = String(document?.storageKey || document?.storage_key || "");
  const parsed = parseStorageKey(storageKey);

  if (!parsed) {
    return {
      persisted: false,
      provider: "not-configured",
      storageKey,
      sizeBytes: data.length,
      checksumSha256,
      reason: "No storage key available.",
    };
  }

  if (parsed.provider === "generated") {
    return {
      persisted: false,
      provider: "not-configured",
      bucket: "",
      objectPath: parsed.objectPath,
      storageKey,
      sizeBytes: data.length,
      checksumSha256,
      reason: "Storage provider is not configured.",
    };
  }

  if (parsed.provider === "local-dev") {
    const config = resolveStorageConfig(env);
    const written = await writeLocalDevObject({ root: config.localRoot, bucket: parsed.bucket, objectPath: parsed.objectPath, data });
    return {
      persisted: true,
      provider: "local-dev",
      bucket: parsed.bucket,
      objectPath: parsed.objectPath,
      storageKey,
      sizeBytes: data.length,
      checksumSha256,
      localPath: written.localPath,
    };
  }

  if (parsed.provider === "supabase-storage") {
    await uploadSupabaseObject({ env, bucket: parsed.bucket, objectPath: parsed.objectPath, data, contentType });
    return {
      persisted: true,
      provider: "supabase-storage",
      bucket: parsed.bucket,
      objectPath: parsed.objectPath,
      storageKey,
      sizeBytes: data.length,
      checksumSha256,
    };
  }

  if (parsed.provider === "s3-compatible") {
    const error = new Error("S3-compatible storage requires a signed upload adapter before production use.");
    error.status = 503;
    error.code = "STORAGE_PROVIDER_NOT_READY";
    throw error;
  }

  const error = new Error("Storage provider is not supported.");
  error.status = 503;
  error.code = "STORAGE_PROVIDER_NOT_READY";
  throw error;
}

export function parseStorageKey(storageKey) {
  const text = String(storageKey || "").trim();
  if (!text) {
    return null;
  }
  const generated = text.match(/^generated:\/\/(.+)$/u);
  if (generated) {
    return { provider: "generated", bucket: "", objectPath: generated[1] };
  }
  const local = text.match(/^local-dev:\/\/([^/]+)\/(.+)$/u);
  if (local) {
    return { provider: "local-dev", bucket: local[1], objectPath: local[2] };
  }
  const supabase = text.match(/^supabase:\/\/([^/]+)\/(.+)$/u);
  if (supabase) {
    return { provider: "supabase-storage", bucket: supabase[1], objectPath: supabase[2] };
  }
  const s3 = text.match(/^s3:\/\/([^/]+)\/(.+)$/u);
  if (s3) {
    return { provider: "s3-compatible", bucket: s3[1], objectPath: s3[2] };
  }
  return null;
}

async function writeLocalDevObject({ root, bucket, objectPath, data }) {
  const base = resolve(root);
  const segments = objectPath.split("/");
  if (segments.some((segment) => segment === "." || segment === ".." || segment.trim() === "")) {
    const error = new Error("Local storage object path is invalid.");
    error.status = 400;
    error.code = "STORAGE_PATH_INVALID";
    throw error;
  }
  const target = resolve(base, safePath(bucket), ...segments.map(safePathSegment));
  if (target !== base && !target.startsWith(`${base}${sep}`)) {
    const error = new Error("Local storage target is outside the configured storage root.");
    error.status = 400;
    error.code = "STORAGE_PATH_INVALID";
    throw error;
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
  return { localPath: target };
}

async function uploadSupabaseObject({ env, bucket, objectPath, data, contentType }) {
  const baseUrl = requiredUrl(env.SUPABASE_URL, "SUPABASE_URL").replace(/\/+$/u, "");
  const serviceRoleKey = requiredSecret(env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "content-type": contentType,
      "x-upsert": "true",
      "cache-control": "3600",
    },
    body: data,
  });
  if (!response.ok) {
    const error = new Error(`Supabase Storage upload failed with status ${response.status}.`);
    error.status = 503;
    error.code = "STORAGE_UPLOAD_FAILED";
    throw error;
  }
}

function requiredUrl(value, name) {
  const text = String(value || "").trim();
  if (!/^https:\/\/[^\s]+$/u.test(text)) {
    const error = new Error(`${name} must be a valid HTTPS URL.`);
    error.status = 503;
    error.code = "STORAGE_PROVIDER_NOT_READY";
    throw error;
  }
  return text;
}

function requiredSecret(value, name) {
  const text = String(value || "").trim();
  if (!text) {
    const error = new Error(`${name} is required for Supabase Storage.`);
    error.status = 503;
    error.code = "STORAGE_PROVIDER_NOT_READY";
    throw error;
  }
  return text;
}

function safePath(value) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "unknown";
}

function safePathSegment(value) {
  return safePath(value).replace(/\.+/gu, ".");
}

function safeFilename(value) {
  const text = String(value || "document.pdf")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/gu, "_")
    .slice(0, 160);
  return text || "document.pdf";
}
