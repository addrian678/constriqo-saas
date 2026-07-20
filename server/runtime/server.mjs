import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { runtimeManifest } from "./runtimeManifest.mjs";
import { findRuntimeApiRoute } from "./runtimeRoutes.mjs";
import { createEstimatePdfBuffer, createInvoicePdfBuffer, createReceiptPdfBuffer } from "./pdfDocumentGenerator.mjs";
import {
  createPostgresAuthRepository,
  createPostgresPoolFromEnv,
  createPostgresSessionContextResolver,
} from "./postgresAuthRepository.mjs";
import { createPostgresAttendanceRepository } from "./postgresAttendanceRepository.mjs";
import { createPostgresAssetsRepository } from "./postgresAssetsRepository.mjs";
import { createPostgresCrmRepository } from "./postgresCrmRepository.mjs";
import { createPostgresDocumentsRepository } from "./postgresDocumentsRepository.mjs";
import { createPostgresEstimateRepository } from "./postgresEstimateRepository.mjs";
import { createPostgresFinanceRepository } from "./postgresFinanceRepository.mjs";
import { createPostgresInvoiceRepository } from "./postgresInvoiceRepository.mjs";
import { createPostgresJobRepository } from "./postgresJobRepository.mjs";
import { createPostgresMarketingRepository } from "./postgresMarketingRepository.mjs";
import { createPostgresNotificationsRepository } from "./postgresNotificationsRepository.mjs";
import { createPostgresOrganizationRepository } from "./postgresOrganizationRepository.mjs";
import { createPostgresReportsRepository } from "./postgresReportsRepository.mjs";
import { createPostgresServiceCatalogRepository } from "./postgresServiceCatalogRepository.mjs";
import { createPostgresSuperAdminRepositoryFromEnv } from "./postgresSuperAdminRepository.mjs";
import { createPostgresWorkforceRepository } from "./postgresWorkforceRepository.mjs";
import { storeGeneratedDocumentBuffer } from "./storageRuntime.mjs";

const DEFAULT_PORT = 8789;
const MAX_REQUEST_BYTES = 1024 * 1024;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 120;
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60_000;
const LOGIN_RATE_LIMIT_MAX_REQUESTS = 8;
const SESSION_COOKIE_NAME = "constriqo_session";
const PUBLIC_API_ROUTES = new Set(["/api/modules", "/api/routes", "/api/public/tenant-branding"]);
const AUTH_API_ROUTES = new Set([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/auth/mfa/totp/setup",
  "/api/auth/mfa/totp/verify",
]);

function getAllowedOrigins() {
  return new Set(
    [
      process.env.APP_BASE_URL,
      process.env.VITE_API_BASE_URL,
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://127.0.0.1:5174",
      "http://localhost:5174",
      "http://127.0.0.1:5175",
      "http://localhost:5175",
      "http://127.0.0.1:4173",
      "http://localhost:4173",
      "http://127.0.0.1:4175",
      "http://localhost:4175",
    ].filter(Boolean),
  );
}

function getAllowedOriginDomains() {
  return new Set(
    String(process.env.APP_ALLOWED_ORIGIN_DOMAINS || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isAllowedOrigin(origin) {
  if (!origin) {
    return false;
  }
  if (getAllowedOrigins().has(origin)) {
    return true;
  }
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") {
      return false;
    }
    const hostname = url.hostname.toLowerCase();
    for (const domain of getAllowedOriginDomains()) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function securityHeaders(request) {
  const origin = request?.headers?.origin;
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "permissions-policy": "camera=(self), microphone=(), geolocation=(self), payment=()",
    "cross-origin-opener-policy": "same-origin",
    "vary": "Origin",
  };

  if (isAllowedOrigin(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-methods"] = "GET,POST,PATCH,DELETE,OPTIONS";
    headers["access-control-allow-headers"] = "authorization,content-type,x-request-id";
    headers["access-control-allow-credentials"] = "true";
    headers["access-control-max-age"] = "600";
  }

  if (process.env.APP_ENV === "production") {
    headers["strict-transport-security"] = "max-age=31536000; includeSubDomains";
  }

  return headers;
}

function sendJson(request, response, status, body) {
  const payload = JSON.stringify(body, null, 2);
  response.writeHead(status, securityHeaders(request));
  response.end(payload);
}

async function warmPostgresPool(pool) {
  if (!pool) {
    return;
  }
  const started = Date.now();
  try {
    await pool.query("SELECT 1");
    await pool.query("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1");
    process.stdout.write(`PostgreSQL pool warmed in ${Date.now() - started}ms\n`);
  } catch (error) {
    process.stderr.write(
      JSON.stringify({
        level: "warn",
        code: error.code || "POSTGRES_WARMUP_FAILED",
        message: "PostgreSQL warmup failed; runtime will retry on demand.",
      }) + "\n",
    );
  }
}

function sendJsonWithCookie(request, response, status, body, cookieHeader) {
  const payload = JSON.stringify(body, null, 2);
  response.writeHead(status, {
    ...securityHeaders(request),
    ...(cookieHeader ? { "set-cookie": cookieHeader } : {}),
  });
  response.end(payload);
}

function createInMemoryRateLimiter({ now = () => Date.now() } = {}) {
  const buckets = new Map();

  function consume(key, { limit, windowMs }) {
    const currentTime = now();
    const existing = buckets.get(key);
    const bucket =
      existing && existing.resetAt > currentTime
        ? existing
        : {
            count: 0,
            resetAt: currentTime + windowMs,
          };

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000)),
      };
    }

    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= currentTime) {
          buckets.delete(bucketKey);
        }
      }
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { consume };
}

function getClientFingerprint(request) {
  const forwardedFor = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const realIp = String(request.headers["x-real-ip"] || "").trim();
  const remoteAddress = request.socket?.remoteAddress || "local";
  return forwardedFor || realIp || remoteAddress;
}

function normalizeRateLimitPart(value) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._:-]+/gu, "-")
    .slice(0, 120);
}

function checkRateLimit(rateLimiter, key, policy) {
  if (!rateLimiter?.consume) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return rateLimiter.consume(key, policy);
}

function sendRateLimitResponse(request, response, requestId, retryAfterSeconds) {
  response.writeHead(429, {
    ...securityHeaders(request),
    "retry-after": String(retryAfterSeconds),
  });
  response.end(
    JSON.stringify(
      {
        code: "RATE_LIMITED",
        requestId,
        message: "Demasiados intentos. Espera un momento antes de volver a intentarlo.",
      },
      null,
      2,
    ),
  );
}

function validateProviderReadiness(env = process.env) {
  if (env.APP_ENV !== "production") {
    return {
      providerMode: "development",
      emailProvider: env.EMAIL_PROVIDER || "sandbox",
      storageProvider: env.STORAGE_PROVIDER || "not-configured",
    };
  }

  const missing = [];
  if (!env.EMAIL_PROVIDER || env.EMAIL_PROVIDER === "sandbox" || env.EMAIL_PROVIDER === "not-configured") {
    missing.push("EMAIL_PROVIDER");
  }
  if (!env.STORAGE_PROVIDER || env.STORAGE_PROVIDER === "local" || env.STORAGE_PROVIDER === "local-dev" || env.STORAGE_PROVIDER === "not-configured") {
    missing.push("STORAGE_PROVIDER");
  }
  if (env.STORAGE_PROVIDER === "supabase-storage" && (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
    missing.push("SUPABASE_STORAGE_SECRETS");
  }
  if (env.STORAGE_PROVIDER === "s3-compatible") {
    missing.push("S3_STORAGE_ADAPTER");
  }
  if (env.EMAIL_PROVIDER === "smtp" && (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USERNAME || !env.SMTP_PASSWORD || !env.EMAIL_FROM)) {
    missing.push("SMTP_SECRETS");
  }
  if (env.EMAIL_PROVIDER && env.EMAIL_PROVIDER !== "sandbox" && env.EMAIL_DELIVERY_WORKER_ENABLED !== "true") {
    missing.push("EMAIL_DELIVERY_WORKER_ENABLED");
  }
  if (env.EXTERNAL_PROVIDERS_VERIFIED !== "true") {
    missing.push("EXTERNAL_PROVIDERS_VERIFIED");
  }
  if (!env.APP_BASE_URL || !/^https:\/\//iu.test(env.APP_BASE_URL)) {
    missing.push("APP_BASE_URL_HTTPS");
  }

  if (missing.length > 0) {
    const error = new Error("Production providers are not ready.");
    error.code = "PROVIDERS_NOT_READY";
    error.missingProviders = missing;
    throw error;
  }

  return {
    providerMode: "production",
    emailProvider: env.EMAIL_PROVIDER,
    storageProvider: env.STORAGE_PROVIDER,
  };
}

function publicErrorMessage(error, fallback) {
  if (error?.status && error.status < 500) {
    return error.message || fallback;
  }
  return fallback;
}

function sendPdf(request, response, filename, buffer) {
  response.writeHead(200, {
    ...securityHeaders(request),
    "content-type": "application/pdf",
    "content-length": String(buffer.length),
    "content-disposition": `attachment; filename="${filename.replace(/[^a-zA-Z0-9_.-]/g, "_")}"`,
  });
  response.end(buffer);
}

async function persistGeneratedPdf(context, repository, document, buffer) {
  if (!document?.documentId) {
    return null;
  }
  const storageResult = await storeGeneratedDocumentBuffer(document, buffer, {
    contentType: "application/pdf",
  });
  if (repository?.recordGeneratedDocumentStorage) {
    await repository.recordGeneratedDocumentStorage(context, document.documentId, storageResult);
  } else if (repository?.recordGeneratedDocumentSize) {
    await repository.recordGeneratedDocumentSize(context, document.documentId, buffer.length);
  }
  return storageResult;
}

async function readJsonBody(request) {
  let raw = "";

  for await (const chunk of request) {
    raw += chunk;
    if (Buffer.byteLength(raw, "utf8") > MAX_REQUEST_BYTES) {
      const error = new Error("Request exceeds the runtime size limit.");
      error.status = 413;
      error.code = "REQUEST_TOO_LARGE";
      throw error;
    }
  }

  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.status = 400;
    error.code = "VALIDATION_ERROR";
    throw error;
  }
}

function getRequestId(request) {
  const header = String(request.headers["x-request-id"] || "").trim();
  if (/^[a-zA-Z0-9._:-]{8,96}$/u.test(header)) {
    return header;
  }
  return randomUUID();
}

function hasTenantSpoofingInput(request, url) {
  return (
    request.headers["x-tenant-id"] ||
    request.headers["x-tenant"] ||
    url.searchParams.has("tenant_id") ||
    url.searchParams.has("tenantId")
  );
}

function hasBearerToken(request) {
  const header = getAuthorizationHeader(request);
  return /^Bearer\s+\S+/u.test(header);
}

function getAuthorizationHeader(request) {
  const header = String(request.headers.authorization || "");
  if (/^Bearer\s+\S+/u.test(header)) {
    return header;
  }
  const token = readCookie(request, SESSION_COOKIE_NAME);
  return token ? `Bearer ${token}` : "";
}

function readCookie(request, name) {
  const cookieHeader = String(request.headers.cookie || "");
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("=") || "");
    }
  }
  return "";
}

function createSessionCookie(sessionToken, expiresAt) {
  const maxAge = Math.max(60, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  const secure = process.env.APP_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}; HttpOnly; Path=/api; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function clearSessionCookie() {
  const secure = process.env.APP_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/api; Max-Age=0; SameSite=Lax${secure}`;
}

async function resolveContext(options, request, requestId) {
  if (!options.sessionContextResolver) {
    return {
      status: 503,
      body: {
        code: "AUTH_ADAPTER_NOT_CONFIGURED",
        requestId,
        message: "Authentication adapter must validate the Bearer token before tenant data can be accessed.",
      },
    };
  }

  try {
    return {
      context: await options.sessionContextResolver.resolve({
        requestId,
        authorizationHeader: getAuthorizationHeader(request),
      }),
    };
  } catch (error) {
    return {
      status: error.status || 401,
      body: {
        code: error.code || "AUTH_REQUIRED",
        requestId,
        message: publicErrorMessage(error, "Authentication failed."),
      },
    };
  }
}

function hasCapability(context, capability) {
  return Array.isArray(context?.actor?.capabilities) && context.actor.capabilities.includes(capability);
}

async function enforceTenantUsageGate(options, route, context) {
  if (route.moduleId === "super-admin") {
    return null;
  }

  const organizationRepository = options.organizationRepository || null;
  if (!organizationRepository?.getTenantUsage) {
    return null;
  }

  const usage = await organizationRepository.getTenantUsage(context);
  if (route.moduleId === "marketing" && !usage.marketingAddonEnabled) {
    return {
      status: 402,
      body: {
        code: "ADDON_DISABLED",
        message: "El modulo de marketing no esta activo para esta empresa.",
      },
    };
  }

  if (route.moduleId === "work-proofs" && route.path === "/api/work-proofs/proofs" && !usage.photoEvidenceEnabled) {
    return {
      status: 402,
      body: {
        code: "ADDON_DISABLED",
        message: "El microservicio de evidencias fotograficas no esta activo para esta empresa.",
      },
    };
  }

  const isDocumentWrite =
    route.moduleId === "documents" &&
    route.method === "POST" &&
    !["/api/documents/archive-complete", "/api/documents/cleanup-heavy-files"].includes(route.path);
  if (isDocumentWrite && usage.status === "blocked") {
    return {
      status: 402,
      body: {
        code: "TENANT_STORAGE_LIMIT_REACHED",
        message: "La empresa alcanzo su limite de almacenamiento. Archiva y limpia archivos pesados antes de crear nuevos documentos.",
      },
    };
  }

  return null;
}

function getAuthService(options) {
  return options.authService || null;
}

function getSessionContextResolver(options) {
  return options.sessionContextResolver || options.authService?.sessionContextResolver || null;
}

function sanitizeContext(context) {
  return {
    expiresAt: context.session?.expiresAt,
    tenant: context.tenant,
    actor: {
      userId: context.actor.userId,
      email: context.actor.email,
      displayName: context.actor.displayName,
      role: context.actor.role,
      roles: context.actor.roles || [context.actor.role],
      capabilities: context.actor.capabilities,
    },
  };
}

async function handleAuthRoute(options, request, response, url, requestId) {
  const authService = getAuthService(options);
  const rateLimiter = options.rateLimiter || null;

  if (!authService) {
    sendJson(request, response, 503, {
      code: "AUTH_ADAPTER_NOT_CONFIGURED",
      requestId,
      message: "Authentication contract is ready, but the database-backed auth adapter is not connected yet.",
    });
    return;
  }

  try {
    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readJsonBody(request);
      const loginLimit = checkRateLimit(
        rateLimiter,
        [
          "login",
          getClientFingerprint(request),
          normalizeRateLimitPart(body.tenantId),
          normalizeRateLimitPart(body.email),
        ].join(":"),
        {
          limit: Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX || LOGIN_RATE_LIMIT_MAX_REQUESTS),
          windowMs: Number(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS || LOGIN_RATE_LIMIT_WINDOW_MS),
        },
      );
      if (!loginLimit.allowed) {
        sendRateLimitResponse(request, response, requestId, loginLimit.retryAfterSeconds);
        return;
      }
      const result = await authService.login({
        tenantId: body.tenantId,
        email: body.email,
        password: body.password,
      });
      const cookieHeader =
        result.status === 200 && result.body?.sessionToken && result.body?.expiresAt
          ? createSessionCookie(result.body.sessionToken, result.body.expiresAt)
          : "";
      sendJsonWithCookie(request, response, result.status, { requestId, ...result.body }, cookieHeader);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/mfa/totp/setup") {
      const body = await readJsonBody(request);
      const result = await authService.setupTotp({
        mfaSetupToken: body.mfaSetupToken,
        label: body.label,
      });
      sendJson(request, response, result.status, { requestId, ...result.body });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/mfa/totp/verify") {
      const body = await readJsonBody(request);
      const result = await authService.verifyTotp({
        mfaChallengeToken: body.mfaChallengeToken,
        mfaSetupToken: body.mfaSetupToken,
        factorId: body.factorId,
        code: body.code,
      });
      const cookieHeader =
        result.status === 200 && result.body?.sessionToken && result.body?.expiresAt
          ? createSessionCookie(result.body.sessionToken, result.body.expiresAt)
          : "";
      sendJsonWithCookie(request, response, result.status, { requestId, ...result.body }, cookieHeader);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/auth/session") {
      const resolver = getSessionContextResolver(options);
      const contextResult = await resolveContext({ ...options, sessionContextResolver: resolver }, request, requestId);
      if (!contextResult.context) {
        sendJson(request, response, contextResult.status, contextResult.body);
        return;
      }

      sendJson(request, response, 200, { requestId, session: sanitizeContext(contextResult.context) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      if (!hasBearerToken(request)) {
        sendJson(request, response, 401, {
          code: "AUTH_REQUIRED",
          requestId,
          message: "A valid SaaS session is required before logout.",
        });
        return;
      }

      await authService.logout(getAuthorizationHeader(request));
      sendJsonWithCookie(request, response, 200, { requestId, status: "revoked" }, clearSessionCookie());
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "Auth route does not support this method.",
    });
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          level: "error",
          requestId,
          path: url.pathname,
          code: error.code || "INTERNAL_ERROR",
          detail: error.message || "Authentication request failed.",
        },
        null,
        2,
      ),
    );
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "Authentication request failed."),
    });
  }
}

async function handlePublicTenantBrandingRoute(options, request, response, url, requestId) {
  const organizationRepository = options.organizationRepository || null;
  if (!organizationRepository?.getPublicTenantBranding) {
    sendJson(request, response, 503, {
      code: "ORGANIZATION_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "Branding publico de empresa no disponible.",
    });
    return;
  }

  try {
    const tenantSlug = String(url.searchParams.get("tenantSlug") || "").trim();
    const branding = await organizationRepository.getPublicTenantBranding(tenantSlug);
    if (!branding) {
      sendJson(request, response, 404, {
        code: "TENANT_NOT_FOUND",
        requestId,
        message: "No se encontro una empresa activa para ese codigo publico.",
      });
      return;
    }

    sendJson(request, response, 200, { requestId, branding });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo cargar el branding de empresa."),
    });
  }
}

async function handleCrmRoute(options, request, response, url, route, context, requestId) {
  const crmRepository = options.crmRepository || null;

  if (!crmRepository) {
    sendJson(request, response, 503, {
      code: "CRM_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "El repositorio CRM real no esta conectado al runtime.",
    });
    return;
  }

  try {
    if (request.method === "GET" && route.path === "/api/crm/clients") {
      const result = await crmRepository.listClients(context, {
        search: url.searchParams.get("search") || "",
        status: url.searchParams.get("status") || "",
        limit: url.searchParams.get("limit") || undefined,
        offset: url.searchParams.get("offset") || undefined,
      });
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/crm/clients") {
      const body = await readJsonBody(request);
      const client = await crmRepository.createClient(context, body);
      sendJson(request, response, 201, { requestId, client });
      return;
    }

    if (request.method === "GET" && route.path === "/api/crm/clients/:clientId") {
      const detail = await crmRepository.getClient(context, route.params.clientId);
      if (!detail) {
        sendJson(request, response, 404, {
          code: "NOT_FOUND",
          requestId,
          message: "Cliente no encontrado para esta empresa.",
        });
        return;
      }
      sendJson(request, response, 200, { requestId, ...detail });
      return;
    }

    if (request.method === "PATCH" && route.path === "/api/crm/clients/:clientId") {
      const body = await readJsonBody(request);
      const client = await crmRepository.updateClient(context, route.params.clientId, body);
      if (!client) {
        sendJson(request, response, 404, {
          code: "NOT_FOUND",
          requestId,
          message: "Cliente no encontrado para esta empresa.",
        });
        return;
      }
      sendJson(request, response, 200, { requestId, client });
      return;
    }

    if (request.method === "DELETE" && route.path === "/api/crm/clients/:clientId") {
      const client = await crmRepository.archiveClient(context, route.params.clientId);
      if (!client) {
        sendJson(request, response, 404, {
          code: "NOT_FOUND",
          requestId,
          message: "Cliente no encontrado para esta empresa.",
        });
        return;
      }
      sendJson(request, response, 200, { requestId, client });
      return;
    }

    if (request.method === "POST" && route.path === "/api/crm/activities") {
      const body = await readJsonBody(request);
      const activity = await crmRepository.createActivity(context, body);
      sendJson(request, response, 201, { requestId, activity });
      return;
    }

    if (request.method === "POST" && route.path === "/api/crm/clients/:clientId/notes") {
      const body = await readJsonBody(request);
      const note = await crmRepository.createNote(context, route.params.clientId, body);
      sendJson(request, response, 201, { requestId, note });
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "La ruta CRM no soporta este metodo.",
    });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo completar la operacion CRM."),
    });
  }
}

async function handleEstimateRoute(options, request, response, url, route, context, requestId) {
  const estimateRepository = options.estimateRepository || null;

  if (!estimateRepository) {
    sendJson(request, response, 503, {
      code: "ESTIMATE_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "El repositorio de cotizaciones reales no esta conectado al runtime.",
    });
    return;
  }

  try {
    if (request.method === "GET" && route.path === "/api/estimates") {
      const result = await estimateRepository.listEstimates(context, {
        search: url.searchParams.get("search") || "",
        status: url.searchParams.get("status") || "",
        limit: url.searchParams.get("limit") || undefined,
        offset: url.searchParams.get("offset") || undefined,
      });
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/estimates") {
      const body = await readJsonBody(request);
      const estimate = await estimateRepository.createEstimate(context, body);
      sendJson(request, response, 201, { requestId, estimate });
      return;
    }

    if (request.method === "GET" && route.path === "/api/estimates/:estimateId") {
      const detail = await estimateRepository.getEstimate(context, route.params.estimateId);
      if (!detail) {
        sendJson(request, response, 404, {
          code: "NOT_FOUND",
          requestId,
          message: "Cotizacion no encontrada para esta empresa.",
        });
        return;
      }
      sendJson(request, response, 200, { requestId, ...detail });
      return;
    }

    if (request.method === "GET" && route.path === "/api/estimates/:estimateId/pdf") {
      const detail = await estimateRepository.getEstimate(context, route.params.estimateId);
      if (!detail) {
        sendJson(request, response, 404, {
          code: "NOT_FOUND",
          requestId,
          message: "Cotizacion no encontrada para esta empresa.",
        });
        return;
      }
      const pdf = createEstimatePdfBuffer(detail);
      if (estimateRepository.archiveEstimatePdf) {
        const archived = await estimateRepository.archiveEstimatePdf(context, route.params.estimateId, pdf.length);
        await persistGeneratedPdf(context, estimateRepository, archived.document, pdf);
      }
      sendPdf(request, response, `${detail.estimate.estimateNumber}.pdf`, pdf);
      return;
    }

    if (request.method === "POST" && route.path === "/api/estimates/:estimateId/send-email") {
      const body = await readJsonBody(request);
      const delivery = await estimateRepository.queueEstimateEmail(context, route.params.estimateId, body);
      sendJson(request, response, 202, { requestId, delivery });
      return;
    }

    if (request.method === "PATCH" && route.path === "/api/estimates/:estimateId") {
      const body = await readJsonBody(request);
      const estimate = await estimateRepository.updateEstimate(context, route.params.estimateId, body);
      if (!estimate) {
        sendJson(request, response, 404, {
          code: "NOT_FOUND",
          requestId,
          message: "Cotizacion no encontrada para esta empresa.",
        });
        return;
      }
      sendJson(request, response, 200, { requestId, estimate });
      return;
    }

    if (request.method === "POST" && route.path === "/api/estimates/:estimateId/versions") {
      const body = await readJsonBody(request);
      const version = await estimateRepository.createVersion(context, route.params.estimateId, body);
      if (!version) {
        sendJson(request, response, 404, {
          code: "NOT_FOUND",
          requestId,
          message: "Cotizacion no encontrada para esta empresa.",
        });
        return;
      }
      sendJson(request, response, 201, { requestId, version });
      return;
    }

    if (request.method === "POST" && route.path === "/api/estimates/:estimateId/approve") {
      const body = await readJsonBody(request);
      const approval = await estimateRepository.approveEstimate(context, route.params.estimateId, body);
      if (!approval) {
        sendJson(request, response, 404, {
          code: "NOT_FOUND",
          requestId,
          message: "Cotizacion no encontrada para esta empresa.",
        });
        return;
      }
      sendJson(request, response, 201, { requestId, approval });
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "La ruta de cotizaciones no soporta este metodo.",
    });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo completar la operacion de cotizaciones."),
    });
  }
}

async function handleServiceCatalogRoute(options, request, response, url, route, context, requestId) {
  const serviceCatalogRepository = options.serviceCatalogRepository || null;

  if (!serviceCatalogRepository) {
    sendJson(request, response, 503, {
      code: "SERVICE_CATALOG_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "El catalogo real de servicios y precios no esta conectado al runtime.",
    });
    return;
  }

  try {
    if (request.method === "GET" && route.path === "/api/services/prices") {
      const result = await serviceCatalogRepository.listServices(context, {
        search: url.searchParams.get("search") || "",
        status: url.searchParams.get("status") || "",
      });
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/services/prices") {
      const body = await readJsonBody(request);
      const service = await serviceCatalogRepository.createService(context, body);
      sendJson(request, response, 201, { requestId, service });
      return;
    }

    if (request.method === "PATCH" && route.path === "/api/services/prices/:serviceId") {
      const body = await readJsonBody(request);
      const service = await serviceCatalogRepository.updateService(context, route.params.serviceId, body);
      if (!service) {
        sendJson(request, response, 404, {
          code: "NOT_FOUND",
          requestId,
          message: "Servicio no encontrado para esta empresa.",
        });
        return;
      }
      sendJson(request, response, 200, { requestId, service });
      return;
    }

    if (request.method === "DELETE" && route.path === "/api/services/prices/:serviceId") {
      const service = await serviceCatalogRepository.archiveService(context, route.params.serviceId);
      if (!service) {
        sendJson(request, response, 404, {
          code: "NOT_FOUND",
          requestId,
          message: "Servicio no encontrado para esta empresa.",
        });
        return;
      }
      sendJson(request, response, 200, { requestId, service });
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "La ruta de servicios y precios no soporta este metodo.",
    });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo completar la operacion de servicios y precios."),
    });
  }
}

async function handleOrganizationRoute(options, request, response, route, context, requestId) {
  const organizationRepository = options.organizationRepository || null;

  if (!organizationRepository) {
    sendJson(request, response, 503, {
      code: "ORGANIZATION_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "La configuracion real de empresa no esta conectada al runtime.",
    });
    return;
  }

  try {
    if (request.method === "GET" && route.path === "/api/organization/settings") {
      const settings = await organizationRepository.getSettings(context);
      sendJson(request, response, 200, { requestId, settings });
      return;
    }

    if (request.method === "PATCH" && route.path === "/api/organization/settings") {
      const body = await readJsonBody(request);
      const settings = await organizationRepository.updateSettings(context, body);
      sendJson(request, response, 200, { requestId, settings });
      return;
    }

    if (request.method === "PATCH" && route.path === "/api/organization/settings/:key") {
      const body = await readJsonBody(request);
      const settings = await organizationRepository.updateSettings(context, { [route.params.key]: body.value });
      sendJson(request, response, 200, { requestId, settings });
      return;
    }

    if (request.method === "GET" && route.path === "/api/organization/usage") {
      const usage = await organizationRepository.getTenantUsage(context);
      sendJson(request, response, 200, { requestId, usage });
      return;
    }

    if (request.method === "PATCH" && route.path === "/api/organization/usage") {
      const body = await readJsonBody(request);
      const usage = await organizationRepository.updateTenantUsageLimits(context, body);
      sendJson(request, response, 200, { requestId, usage });
      return;
    }

    if (request.method === "GET" && route.path === "/api/organization/users") {
      const items = await organizationRepository.listUsers(context);
      sendJson(request, response, 200, { requestId, items, total: items.length });
      return;
    }

    if (request.method === "POST" && route.path === "/api/organization/users") {
      const body = await readJsonBody(request);
      const result = await organizationRepository.createUser(context, body);
      sendJson(request, response, 201, { requestId, ...result });
      return;
    }

    if (request.method === "PATCH" && route.path === "/api/organization/users/:userId") {
      const body = await readJsonBody(request);
      const user = await organizationRepository.updateUser(context, route.params.userId, body);
      sendJson(request, response, 200, { requestId, user });
      return;
    }

    if (request.method === "POST" && route.path === "/api/organization/users/:userId/reset-password") {
      const body = await readJsonBody(request);
      const result = await organizationRepository.resetUserPassword(context, route.params.userId, body);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "GET" && route.path === "/api/compliance/policy-acceptances") {
      const items = await organizationRepository.listPolicyAcceptances(context);
      sendJson(request, response, 200, { requestId, items, total: items.length });
      return;
    }

    if (request.method === "POST" && route.path === "/api/compliance/policy-acceptances") {
      const body = await readJsonBody(request);
      const items = await organizationRepository.acceptPolicies(context, body);
      sendJson(request, response, 201, { requestId, items, total: items.length });
      return;
    }

    if (request.method === "GET" && route.path === "/api/compliance/privacy-preferences") {
      const preferences = await organizationRepository.getPrivacyPreferences(context);
      sendJson(request, response, 200, { requestId, preferences });
      return;
    }

    if (request.method === "PATCH" && route.path === "/api/compliance/privacy-preferences") {
      const body = await readJsonBody(request);
      const preferences = await organizationRepository.updatePrivacyPreferences(context, body);
      sendJson(request, response, 200, { requestId, preferences });
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "La ruta de organizacion no soporta este metodo.",
    });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo completar la operacion de organizacion."),
    });
  }
}

async function handleJobRoute(options, request, response, route, context, requestId) {
  const jobRepository = options.jobRepository || null;

  if (!jobRepository) {
    sendJson(request, response, 503, {
      code: "JOB_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "El repositorio real de obras no esta conectado al runtime.",
    });
    return;
  }

  try {
    if (request.method === "GET" && route.path === "/api/jobs") {
      const result = await jobRepository.listJobs(context);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/jobs") {
      const body = await readJsonBody(request);
      const job = await jobRepository.createJob(context, body);
      sendJson(request, response, 201, { requestId, job });
      return;
    }

    if (request.method === "GET" && route.path === "/api/jobs/:jobId") {
      const detail = await jobRepository.getJob(context, route.params.jobId);
      if (!detail) {
        sendJson(request, response, 404, {
          code: "NOT_FOUND",
          requestId,
          message: "Obra no encontrada para esta empresa.",
        });
        return;
      }
      sendJson(request, response, 200, { requestId, ...detail });
      return;
    }

    if (request.method === "PATCH" && route.path === "/api/jobs/:jobId") {
      const body = await readJsonBody(request);
      const job = await jobRepository.updateJob(context, route.params.jobId, body);
      if (!job) {
        sendJson(request, response, 404, {
          code: "NOT_FOUND",
          requestId,
          message: "Obra no encontrada para esta empresa.",
        });
        return;
      }
      sendJson(request, response, 200, { requestId, job });
      return;
    }

    if (request.method === "POST" && route.path === "/api/jobs/:jobId/assignments") {
      const body = await readJsonBody(request);
      const assignment = await jobRepository.assignWorkerToJob(context, route.params.jobId, body);
      sendJson(request, response, 201, { requestId, assignment });
      return;
    }

    if (request.method === "POST" && route.path === "/api/jobs/:jobId/tasks") {
      const body = await readJsonBody(request);
      const task = await jobRepository.createTask(context, route.params.jobId, body);
      sendJson(request, response, 201, { requestId, task });
      return;
    }

    if (request.method === "PATCH" && route.path === "/api/jobs/:jobId/tasks/:taskId") {
      const body = await readJsonBody(request);
      const task = await jobRepository.updateTask(context, route.params.jobId, route.params.taskId, body);
      sendJson(request, response, 200, { requestId, task });
      return;
    }

    if (request.method === "POST" && route.path === "/api/jobs/:jobId/change-requests") {
      const body = await readJsonBody(request);
      const changeRequest = await jobRepository.createChangeRequest(context, route.params.jobId, body);
      sendJson(request, response, 201, { requestId, changeRequest });
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "La ruta de obras no soporta este metodo.",
    });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo completar la operacion de obras."),
    });
  }
}

async function handleWorkerSelfRoute(options, request, response, route, context, requestId) {
  const jobRepository = options.jobRepository || null;

  if (!jobRepository) {
    sendJson(request, response, 503, {
      code: "JOB_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "El repositorio real de tareas de trabajador no esta conectado al runtime.",
    });
    return;
  }

  try {
    if (request.method === "GET" && route.path === "/api/worker/tasks") {
      const result = await jobRepository.listWorkerTasks(context);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "PATCH" && route.path === "/api/worker/tasks/:taskId") {
      const body = await readJsonBody(request);
      const task = await jobRepository.updateWorkerTask(context, route.params.taskId, body);
      sendJson(request, response, 200, { requestId, task });
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "La ruta de trabajador no soporta este metodo.",
    });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo completar la operacion del trabajador."),
    });
  }
}

async function handleWorkforceRoute(options, request, response, url, route, context, requestId) {
  const workforceRepository = options.workforceRepository || null;

  if (!workforceRepository) {
    sendJson(request, response, 503, {
      code: "WORKFORCE_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "El repositorio real de trabajadores no esta conectado al runtime.",
    });
    return;
  }

  try {
    if (request.method === "GET" && route.path === "/api/workforce/workers") {
      const result = await workforceRepository.listWorkers(context, {
        search: url.searchParams.get("search") || "",
        status: url.searchParams.get("status") || "",
      });
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/workforce/workers") {
      const body = await readJsonBody(request);
      const worker = await workforceRepository.createWorker(context, body);
      sendJson(request, response, 201, { requestId, worker });
      return;
    }

    if (request.method === "POST" && route.path === "/api/workforce/worker-users") {
      const body = await readJsonBody(request);
      const result = await workforceRepository.createWorkerUser(context, body);
      sendJson(request, response, 201, { requestId, ...result });
      return;
    }

    if (request.method === "GET" && route.path === "/api/workforce/workers/:workerId") {
      const detail = await workforceRepository.getWorker(context, route.params.workerId);
      if (!detail) {
        sendJson(request, response, 404, {
          code: "NOT_FOUND",
          requestId,
          message: "Trabajador no encontrado para esta empresa.",
        });
        return;
      }
      sendJson(request, response, 200, { requestId, ...detail });
      return;
    }

    if (request.method === "PATCH" && route.path === "/api/workforce/workers/:workerId") {
      const body = await readJsonBody(request);
      const worker = await workforceRepository.updateWorker(context, route.params.workerId, body);
      if (!worker) {
        sendJson(request, response, 404, {
          code: "NOT_FOUND",
          requestId,
          message: "Trabajador no encontrado para esta empresa.",
        });
        return;
      }
      sendJson(request, response, 200, { requestId, worker });
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "La ruta de trabajadores no soporta este metodo.",
    });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo completar la operacion de trabajadores."),
    });
  }
}

async function handleAttendanceRoute(options, request, response, url, route, context, requestId) {
  const attendanceRepository = options.attendanceRepository || null;

  if (!attendanceRepository) {
    sendJson(request, response, 503, {
      code: "ATTENDANCE_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "El repositorio real de asistencia no esta conectado al runtime.",
    });
    return;
  }

  try {
    if (request.method === "GET" && route.path === "/api/attendance/time-entries") {
      const result = await attendanceRepository.listTimeEntries(context, {
        status: url.searchParams.get("status") || "",
        workerId: url.searchParams.get("workerId") || "",
      });
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "GET" && route.path === "/api/attendance/me") {
      const result = await attendanceRepository.getMyAttendance(context);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/attendance/clock-in") {
      const body = await readJsonBody(request);
      const entry = await attendanceRepository.clockIn(context, body);
      sendJson(request, response, 201, { requestId, entry });
      return;
    }

    if (request.method === "POST" && route.path === "/api/attendance/break-start") {
      const entry = await attendanceRepository.startBreak(context);
      sendJson(request, response, 200, { requestId, entry });
      return;
    }

    if (request.method === "POST" && route.path === "/api/attendance/break-end") {
      const entry = await attendanceRepository.endBreak(context);
      sendJson(request, response, 200, { requestId, entry });
      return;
    }

    if (request.method === "POST" && route.path === "/api/attendance/clock-out") {
      const body = await readJsonBody(request);
      const entry = await attendanceRepository.clockOut(context, body);
      sendJson(request, response, 200, { requestId, entry });
      return;
    }

    if (request.method === "POST" && route.path === "/api/attendance/time-entries/:timeEntryId/approve") {
      const body = await readJsonBody(request);
      const entry = await attendanceRepository.reviewTimeEntry(context, route.params.timeEntryId, {
        ...body,
        status: body.status || "approved",
      });
      sendJson(request, response, 200, { requestId, entry });
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "La ruta de asistencia no soporta este metodo.",
    });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo completar la operacion de asistencia."),
    });
  }
}

async function handleExpenseRoute(options, request, response, route, context, requestId) {
  const financeRepository = options.financeRepository || null;

  if (!financeRepository) {
    sendJson(request, response, 503, {
      code: "FINANCE_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "El repositorio real financiero no esta conectado al runtime.",
    });
    return;
  }

  try {
    if (request.method === "GET" && route.path === "/api/expenses") {
      const result = await financeRepository.listExpenses(context);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/expenses") {
      const body = await readJsonBody(request);
      const expense = await financeRepository.createExpense(context, body);
      sendJson(request, response, 201, { requestId, expense });
      return;
    }

    if (request.method === "GET" && route.path === "/api/expenses/vendors") {
      const result = await financeRepository.listVendors(context);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/expenses/vendors") {
      const body = await readJsonBody(request);
      const vendor = await financeRepository.createVendor(context, body);
      sendJson(request, response, 201, { requestId, vendor });
      return;
    }

    if (request.method === "POST" && route.path === "/api/expenses/:expenseId/approve") {
      const expense = await financeRepository.approveExpense(context, route.params.expenseId);
      sendJson(request, response, 200, { requestId, expense });
      return;
    }

    if (request.method === "POST" && route.path === "/api/expenses/:expenseId/payments") {
      const body = await readJsonBody(request);
      const expense = await financeRepository.recordExpensePayment(context, route.params.expenseId, body);
      sendJson(request, response, 200, { requestId, expense });
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "La ruta de gastos no soporta este metodo.",
    });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo completar la operacion de gastos."),
    });
  }
}

async function handleInvoiceRoute(options, request, response, url, route, context, requestId) {
  const invoiceRepository = options.invoiceRepository || null;

  if (!invoiceRepository) {
    sendJson(request, response, 503, {
      code: "INVOICE_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "El repositorio real de facturacion no esta conectado al runtime.",
    });
    return;
  }

  try {
    if (request.method === "GET" && route.path === "/api/invoicing/invoices") {
      const result = await invoiceRepository.listInvoices(context, {
        search: url.searchParams.get("search") || "",
        status: url.searchParams.get("status") || "",
      });
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/invoicing/invoices") {
      const body = await readJsonBody(request);
      const invoice = await invoiceRepository.createInvoice(context, body);
      sendJson(request, response, 201, { requestId, invoice });
      return;
    }

    if (request.method === "GET" && route.path === "/api/invoicing/invoices/:invoiceId") {
      const detail = await invoiceRepository.getInvoice(context, route.params.invoiceId);
      if (!detail) {
        sendJson(request, response, 404, {
          code: "NOT_FOUND",
          requestId,
          message: "Factura no encontrada para esta empresa.",
        });
        return;
      }
      sendJson(request, response, 200, { requestId, ...detail });
      return;
    }

    if (request.method === "POST" && route.path === "/api/invoicing/invoices/:invoiceId/issue") {
      const invoice = await invoiceRepository.issueInvoice(context, route.params.invoiceId);
      sendJson(request, response, 200, { requestId, invoice });
      return;
    }

    if (request.method === "PATCH" && route.path === "/api/invoicing/invoices/:invoiceId/status") {
      const body = await readJsonBody(request);
      const invoice = await invoiceRepository.updateInvoiceStatus(context, route.params.invoiceId, body);
      sendJson(request, response, 200, { requestId, invoice });
      return;
    }

    if (request.method === "POST" && route.path === "/api/invoicing/invoices/:invoiceId/payments") {
      const body = await readJsonBody(request);
      const result = await invoiceRepository.recordPayment(context, route.params.invoiceId, body);
      sendJson(request, response, 201, { requestId, ...result });
      return;
    }

    if (request.method === "GET" && route.path === "/api/invoicing/invoices/:invoiceId/pdf") {
      const detail = await invoiceRepository.archiveInvoicePdf(context, route.params.invoiceId);
      const pdf = createInvoicePdfBuffer(detail);
      await persistGeneratedPdf(context, invoiceRepository, detail.document, pdf);
      sendPdf(request, response, `${detail.invoice.invoiceNumber}.pdf`, pdf);
      return;
    }

    if (request.method === "POST" && route.path === "/api/invoicing/invoices/:invoiceId/send-email") {
      const body = await readJsonBody(request);
      const delivery = await invoiceRepository.queueInvoiceEmail(context, route.params.invoiceId, body);
      sendJson(request, response, 202, { requestId, delivery });
      return;
    }

    if (request.method === "GET" && route.path === "/api/invoicing/invoices/:invoiceId/payments/:paymentId/receipt.pdf") {
      const detail = await invoiceRepository.archiveReceiptPdf(context, route.params.invoiceId, route.params.paymentId);
      const pdf = createReceiptPdfBuffer(detail, detail.payment);
      await persistGeneratedPdf(context, invoiceRepository, detail.document, pdf);
      sendPdf(request, response, `${detail.payment.receiptNumber || detail.payment.paymentId}.pdf`, pdf);
      return;
    }

    if (request.method === "POST" && route.path === "/api/invoicing/invoices/:invoiceId/credit-notes") {
      const body = await readJsonBody(request);
      const invoice = await invoiceRepository.createCreditNote(context, route.params.invoiceId, body);
      sendJson(request, response, 201, { requestId, invoice });
      return;
    }

    if (request.method === "POST" && route.path === "/api/invoicing/payments") {
      const body = await readJsonBody(request);
      const result = await invoiceRepository.recordPayment(context, body.invoiceId, body);
      sendJson(request, response, 201, { requestId, ...result });
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "La ruta de facturacion no soporta este metodo.",
    });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo completar la operacion de facturacion."),
    });
  }
}

async function handleFinanceRoute(options, request, response, route, context, requestId) {
  const financeRepository = options.financeRepository || null;

  if (!financeRepository) {
    sendJson(request, response, 503, {
      code: "FINANCE_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "El repositorio real financiero no esta conectado al runtime.",
    });
    return;
  }

  try {
    if (request.method === "GET" && route.path === "/api/finance/dashboard") {
      const dashboard = await financeRepository.getDashboard(context);
      sendJson(request, response, 200, { requestId, dashboard });
      return;
    }

    if (request.method === "GET" && route.path === "/api/finance/accounts") {
      const result = await financeRepository.listAccounts(context);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "GET" && route.path === "/api/finance/transactions") {
      const result = await financeRepository.listTransactions(context);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/finance/transactions") {
      const body = await readJsonBody(request);
      const transaction = await financeRepository.createManualTransaction(context, body);
      sendJson(request, response, 201, { requestId, transaction });
      return;
    }

    if (request.method === "POST" && route.path === "/api/finance/transactions/:transactionId/correct") {
      const body = await readJsonBody(request);
      const result = await financeRepository.correctManualTransaction(context, route.params.transactionId, body);
      sendJson(request, response, 201, { requestId, ...result });
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "La ruta financiera no soporta este metodo.",
    });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo completar la operacion financiera."),
    });
  }
}

async function handleAssetsRoute(options, request, response, route, context, requestId) {
  const assetsRepository = options.assetsRepository || null;

  if (!assetsRepository) {
    sendJson(request, response, 503, {
      code: "ASSETS_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "El repositorio real de activos y pasivos no esta conectado al runtime.",
    });
    return;
  }

  try {
    if (request.method === "GET" && route.path === "/api/assets") {
      const result = await assetsRepository.listAssets(context);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/assets") {
      const body = await readJsonBody(request);
      const asset = await assetsRepository.createAsset(context, body);
      sendJson(request, response, 201, { requestId, asset });
      return;
    }

    if (request.method === "GET" && route.path === "/api/liabilities") {
      const result = await assetsRepository.listLiabilities(context);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/liabilities") {
      const body = await readJsonBody(request);
      const liability = await assetsRepository.createLiability(context, body);
      sendJson(request, response, 201, { requestId, liability });
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "La ruta de activos y pasivos no soporta este metodo.",
    });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo completar la operacion de activos y pasivos."),
    });
  }
}

async function handleNotificationsRoute(options, request, response, url, route, context, requestId) {
  const notificationsRepository = options.notificationsRepository || null;

  if (!notificationsRepository) {
    sendJson(request, response, 503, {
      code: "NOTIFICATIONS_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "El repositorio real de notificaciones y auditoria no esta conectado al runtime.",
    });
    return;
  }

  try {
    if (request.method === "GET" && route.path === "/api/notifications") {
      const result = await notificationsRepository.listNotifications(context, {
        role: url.searchParams.get("role") || "",
        status: url.searchParams.get("status") || "",
      });
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "PATCH" && route.path === "/api/notifications/:notificationId/read") {
      const notification = await notificationsRepository.markNotificationRead(context, route.params.notificationId);
      sendJson(request, response, 200, { requestId, notification });
      return;
    }

    if (request.method === "POST" && route.path === "/api/notifications/read-visible") {
      const body = await readJsonBody(request);
      const result = await notificationsRepository.markNotificationsRead(context, {
        role: body.role || url.searchParams.get("role") || "",
        status: body.status || url.searchParams.get("status") || "",
      });
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "GET" && route.path === "/api/audit-events") {
      const result = await notificationsRepository.listAuditEvents(context, {
        moduleId: url.searchParams.get("moduleId") || "",
      });
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "GET" && route.path === "/api/email/deliveries") {
      const result = await notificationsRepository.listEmailDeliveries(context, {
        status: url.searchParams.get("status") || "",
        search: url.searchParams.get("search") || "",
      });
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "GET" && route.path === "/api/notifications/preferences") {
      const result = await notificationsRepository.listNotificationPreferences(context);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "PATCH" && route.path === "/api/notifications/preferences") {
      const body = await readJsonBody(request);
      const preference = await notificationsRepository.updateNotificationPreference(context, body);
      sendJson(request, response, 200, { requestId, preference });
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "La ruta de notificaciones no soporta este metodo.",
    });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo completar la operacion de notificaciones."),
    });
  }
}

async function handleMarketingRoute(options, request, response, route, context, requestId) {
  const marketingRepository = options.marketingRepository || null;

  if (!marketingRepository) {
    sendJson(request, response, 503, {
      code: "MARKETING_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "El repositorio real de marketing no esta conectado al runtime.",
    });
    return;
  }

  try {
    if (request.method === "GET" && route.path === "/api/marketing/campaigns") {
      const result = await marketingRepository.listCampaigns(context);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/marketing/campaigns") {
      const body = await readJsonBody(request);
      const campaign = await marketingRepository.createCampaign(context, body);
      sendJson(request, response, 201, { requestId, campaign });
      return;
    }

    if (request.method === "GET" && route.path === "/api/marketing/leads") {
      const result = await marketingRepository.listLeads(context);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/marketing/leads") {
      const body = await readJsonBody(request);
      const lead = await marketingRepository.createLead(context, body);
      sendJson(request, response, 201, { requestId, lead });
      return;
    }

    if (request.method === "GET" && route.path === "/api/marketing/loyalty-cards") {
      const result = await marketingRepository.listLoyaltyCards(context);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/marketing/loyalty-cards") {
      const body = await readJsonBody(request);
      const card = await marketingRepository.createLoyaltyCard(context, body);
      sendJson(request, response, 201, { requestId, card });
      return;
    }

    if (request.method === "PATCH" && route.path === "/api/marketing/loyalty-cards/:loyaltyCardId") {
      const body = await readJsonBody(request);
      const card = await marketingRepository.updateLoyaltyCard(context, route.params.loyaltyCardId, body);
      sendJson(request, response, 200, { requestId, card });
      return;
    }

    if (request.method === "POST" && route.path === "/api/marketing/leads/:marketingLeadId/convert") {
      const result = await marketingRepository.convertLead(context, route.params.marketingLeadId);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "La ruta de marketing no soporta este metodo.",
    });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo completar la operacion de marketing."),
    });
  }
}

async function handleReportsRoute(options, request, response, route, context, requestId) {
  const reportsRepository = options.reportsRepository || null;

  if (!reportsRepository) {
    sendJson(request, response, 503, {
      code: "REPORTS_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "El repositorio real de reportes no esta conectado al runtime.",
    });
    return;
  }

  try {
    if (request.method === "GET" && route.path === "/api/reports/summary") {
      const report = await reportsRepository.getSummary(context);
      sendJson(request, response, 200, { requestId, report });
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "La ruta de reportes no soporta este metodo.",
    });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo completar la consulta de reportes."),
    });
  }
}

async function handleDocumentsRoute(options, request, response, route, context, requestId) {
  const documentsRepository = options.documentsRepository || null;

  if (!documentsRepository) {
    sendJson(request, response, 503, {
      code: "DOCUMENTS_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "El repositorio real de documentos no esta conectado al runtime.",
    });
    return;
  }

  try {
    if (request.method === "GET" && route.path === "/api/documents") {
      const result = await documentsRepository.listDocuments(context);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "GET" && route.path === "/api/documents/archive-plan") {
      const result = await documentsRepository.getArchivePlan(context);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "GET" && route.path === "/api/documents/cleanup-status") {
      const result = await documentsRepository.getCleanupStatus(context);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/documents/archive-complete") {
      const body = await readJsonBody(request);
      const result = await documentsRepository.markArchiveCompleted(context, body);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/documents/cleanup-heavy-files") {
      const body = await readJsonBody(request);
      const result = await documentsRepository.cleanupHeavyFiles(context, body);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/documents") {
      const body = await readJsonBody(request);
      const document = await documentsRepository.createDocument(context, body);
      sendJson(request, response, 201, { requestId, document });
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "La ruta de documentos no soporta este metodo.",
    });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo completar la operacion de documentos."),
    });
  }
}

async function handleSuperAdminRoute(options, request, response, route, context, requestId) {
  const superAdminRepository = options.superAdminRepository || null;

  if (!superAdminRepository) {
    sendJson(request, response, 503, {
      code: "SUPER_ADMIN_REPOSITORY_NOT_CONFIGURED",
      requestId,
      message: "La consola Super Admin requiere SUPER_ADMIN_DATABASE_URL o ADMIN_DATABASE_URL en el backend.",
    });
    return;
  }

  try {
    if (request.method === "GET" && route.path === "/api/super-admin/tenants") {
      const result = await superAdminRepository.listTenants(context);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    if (request.method === "POST" && route.path === "/api/super-admin/tenants") {
      const body = await readJsonBody(request);
      const result = await superAdminRepository.createTenant(context, body);
      sendJson(request, response, 201, { requestId, ...result });
      return;
    }

    if (request.method === "PATCH" && route.path === "/api/super-admin/tenants/:tenantId/license") {
      const body = await readJsonBody(request);
      const result = await superAdminRepository.upsertTenantLicense(context, route.params.tenantId, body);
      sendJson(request, response, 200, { requestId, ...result });
      return;
    }

    sendJson(request, response, 405, {
      code: "METHOD_NOT_ALLOWED",
      requestId,
      message: "La ruta Super Admin no soporta este metodo.",
    });
  } catch (error) {
    sendJson(request, response, error.status || 500, {
      code: error.code || "INTERNAL_ERROR",
      requestId,
      message: publicErrorMessage(error, "No se pudo completar la operacion Super Admin."),
    });
  }
}

export function createRuntimeServer(options = {}) {
  const startedAt = new Date().toISOString();
  const manifest = options.manifest || runtimeManifest;
  const rateLimiter = options.rateLimiter === undefined ? createInMemoryRateLimiter() : options.rateLimiter;
  const runtimeOptions = { ...options, rateLimiter };

  return createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
    const contentLength = Number(request.headers["content-length"] || 0);
    const requestId = getRequestId(request);

    if (contentLength > MAX_REQUEST_BYTES) {
      sendJson(request, response, 413, {
        code: "REQUEST_TOO_LARGE",
        message: "Request exceeds the runtime size limit.",
      });
      return;
    }

    const generalLimit = checkRateLimit(
      rateLimiter,
      ["runtime", getClientFingerprint(request), request.method, url.pathname].join(":"),
      {
        limit: Number(process.env.RUNTIME_RATE_LIMIT_MAX || DEFAULT_RATE_LIMIT_MAX_REQUESTS),
        windowMs: Number(process.env.RUNTIME_RATE_LIMIT_WINDOW_MS || DEFAULT_RATE_LIMIT_WINDOW_MS),
      },
    );
    if (!generalLimit.allowed) {
      sendRateLimitResponse(request, response, requestId, generalLimit.retryAfterSeconds);
      return;
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204, securityHeaders(request));
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(request, response, 200, {
        status: "ok",
        name: manifest.name,
        version: manifest.version,
        startedAt,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/ready") {
      if (!options.readinessProbe) {
        sendJson(request, response, 503, {
          status: "not-ready",
          persistence: "not-configured",
          databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
          requestId,
          message: "Runtime readiness requires a configured database probe.",
        });
        return;
      }

      try {
        const readiness = await options.readinessProbe();
        sendJson(request, response, 200, {
          status: "ok",
          persistence: "ready",
          databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
          requestId,
          ...readiness,
        });
      } catch (error) {
        sendJson(request, response, 503, {
          status: "not-ready",
          persistence: "unavailable",
          databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
          requestId,
          code: error.code || "READINESS_CHECK_FAILED",
          message: "PostgreSQL, migraciones o proveedores criticos no estan listos.",
        });
      }
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/modules") {
      sendJson(request, response, 200, {
        modules: manifest.modules,
        deploymentModel: manifest.deploymentModel,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/routes") {
      sendJson(request, response, 200, {
        routes: manifest.routes,
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/public/tenant-branding") {
      await handlePublicTenantBrandingRoute(options, request, response, url, requestId);
      return;
    }

    if (AUTH_API_ROUTES.has(url.pathname)) {
      await handleAuthRoute(runtimeOptions, request, response, url, requestId);
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      if (!PUBLIC_API_ROUTES.has(url.pathname) && hasTenantSpoofingInput(request, url)) {
        sendJson(request, response, 400, {
          code: "VALIDATION_ERROR",
          requestId,
          message: "Tenant must be derived from the authenticated server session, not from client input.",
        });
        return;
      }

      if (!PUBLIC_API_ROUTES.has(url.pathname) && !hasBearerToken(request)) {
        sendJson(request, response, 401, {
          code: "AUTH_REQUIRED",
          requestId,
          message: "A valid SaaS session is required before accessing tenant data.",
        });
        return;
      }

      const route = findRuntimeApiRoute(request.method, url.pathname);
      if (!route) {
        sendJson(request, response, 404, {
          code: "NOT_FOUND",
          requestId,
          message: "API route contract not found.",
        });
        return;
      }

      const contextResult = await resolveContext(
        { ...options, sessionContextResolver: getSessionContextResolver(options) },
        request,
        requestId,
      );
      if (!contextResult.context) {
        sendJson(request, response, contextResult.status, contextResult.body);
        return;
      }

      if (!hasCapability(contextResult.context, route.capability)) {
        sendJson(request, response, 403, {
          code: "FORBIDDEN",
          requestId,
          message: "No tienes permisos para realizar esta accion.",
        });
        return;
      }

      const tenantUsageGate = await enforceTenantUsageGate(options, route, contextResult.context);
      if (tenantUsageGate) {
        sendJson(request, response, tenantUsageGate.status, { requestId, ...tenantUsageGate.body });
        return;
      }

      if (route.moduleId === "super-admin") {
        await handleSuperAdminRoute(options, request, response, route, contextResult.context, requestId);
        return;
      }

      if (route.moduleId === "crm") {
        await handleCrmRoute(options, request, response, url, route, contextResult.context, requestId);
        return;
      }

      if (route.moduleId === "estimates") {
        await handleEstimateRoute(options, request, response, url, route, contextResult.context, requestId);
        return;
      }

      if (route.moduleId === "services-prices") {
        await handleServiceCatalogRoute(options, request, response, url, route, contextResult.context, requestId);
        return;
      }

      if (route.moduleId === "jobs") {
        await handleJobRoute(options, request, response, route, contextResult.context, requestId);
        return;
      }

      if (route.moduleId === "worker-self") {
        await handleWorkerSelfRoute(options, request, response, route, contextResult.context, requestId);
        return;
      }

      if (route.moduleId === "workforce") {
        await handleWorkforceRoute(options, request, response, url, route, contextResult.context, requestId);
        return;
      }

      if (route.moduleId === "attendance") {
        await handleAttendanceRoute(options, request, response, url, route, contextResult.context, requestId);
        return;
      }

      if (route.moduleId === "invoicing") {
        await handleInvoiceRoute(options, request, response, url, route, contextResult.context, requestId);
        return;
      }

      if (route.moduleId === "expenses") {
        await handleExpenseRoute(options, request, response, route, contextResult.context, requestId);
        return;
      }

      if (route.moduleId === "finance") {
        await handleFinanceRoute(options, request, response, route, contextResult.context, requestId);
        return;
      }

      if (route.moduleId === "assets-liabilities") {
        await handleAssetsRoute(options, request, response, route, contextResult.context, requestId);
        return;
      }

      if (route.moduleId === "marketing") {
        await handleMarketingRoute(options, request, response, route, contextResult.context, requestId);
        return;
      }

      if (route.moduleId === "notifications-audit-reports") {
        await handleNotificationsRoute(options, request, response, url, route, contextResult.context, requestId);
        return;
      }

      if (route.moduleId === "reports") {
        await handleReportsRoute(options, request, response, route, contextResult.context, requestId);
        return;
      }

      if (route.moduleId === "documents") {
        await handleDocumentsRoute(options, request, response, route, contextResult.context, requestId);
        return;
      }

      if (route.moduleId === "organization") {
        await handleOrganizationRoute(options, request, response, route, contextResult.context, requestId);
        return;
      }

      sendJson(request, response, 501, {
        code: "NOT_IMPLEMENTED",
        requestId,
        message: "API contract is declared, but runtime handlers are not connected yet.",
      });
      return;
    }

    sendJson(request, response, 404, {
      code: "NOT_FOUND",
      message: "Route not found.",
    });
  });
}

export function createRuntimeAuthServiceFromEnv(env = process.env, providedPool = null) {
  const pool = providedPool || createPostgresPoolFromEnv(env);
  const ownsPool = !providedPool;
  if (!pool) {
    return null;
  }

  const repository = createPostgresAuthRepository(pool, {
    requireAdminMfa: env.AUTH_ADMIN_MFA_REQUIRED !== "false",
  });
  const sessionContextResolver = createPostgresSessionContextResolver(repository);

  return {
    sessionContextResolver,
    login(input) {
      if (!input.tenantId || !input.email || !input.password) {
        return {
          status: 400,
          body: {
            code: "VALIDATION_ERROR",
            message: "tenantId, email y password son obligatorios.",
          },
        };
      }

      return repository.login(input);
    },
    setupTotp(input) {
      if (!input.mfaSetupToken) {
        return {
          status: 400,
          body: {
            code: "VALIDATION_ERROR",
            message: "mfaSetupToken es obligatorio.",
          },
        };
      }

      return repository.setupTotp(input);
    },
    verifyTotp(input) {
      if ((!input.mfaChallengeToken && !input.mfaSetupToken) || !input.code) {
        return {
          status: 400,
          body: {
            code: "VALIDATION_ERROR",
            message: "mfaChallengeToken o mfaSetupToken, y code, son obligatorios.",
          },
        };
      }

      return repository.verifyTotp(input);
    },
    async logout(authorizationHeader) {
      await repository.revokeSession(authorizationHeader);
    },
    async close() {
      if (ownsPool) {
        await pool.end();
      }
    },
  };
}

export function startRuntimeServer(options = {}) {
  const port = Number(options.port ?? process.env.PORT ?? DEFAULT_PORT);
  const defaultHost = ["staging", "production"].includes(process.env.APP_ENV) ? "0.0.0.0" : "127.0.0.1";
  const host = options.host ?? process.env.HOST ?? defaultHost;
  const sharedPool =
    options.postgresPool === undefined && process.env.DATABASE_URL
      ? createPostgresPoolFromEnv(process.env)
      : options.postgresPool;
  const authService = options.authService === undefined ? createRuntimeAuthServiceFromEnv(process.env, sharedPool) : options.authService;
  const attendanceRepository =
    options.attendanceRepository === undefined && sharedPool
      ? createPostgresAttendanceRepository(sharedPool)
      : options.attendanceRepository;
  const financeRepository =
    options.financeRepository === undefined && sharedPool
      ? createPostgresFinanceRepository(sharedPool)
      : options.financeRepository;
  const assetsRepository =
    options.assetsRepository === undefined && sharedPool
      ? createPostgresAssetsRepository(sharedPool)
      : options.assetsRepository;
  const invoiceRepository =
    options.invoiceRepository === undefined && sharedPool
      ? createPostgresInvoiceRepository(sharedPool)
      : options.invoiceRepository;
  const crmRepository =
    options.crmRepository === undefined && sharedPool ? createPostgresCrmRepository(sharedPool) : options.crmRepository;
  const documentsRepository =
    options.documentsRepository === undefined && sharedPool
      ? createPostgresDocumentsRepository(sharedPool)
      : options.documentsRepository;
  const estimateRepository =
    options.estimateRepository === undefined && sharedPool
      ? createPostgresEstimateRepository(sharedPool)
      : options.estimateRepository;
  const serviceCatalogRepository =
    options.serviceCatalogRepository === undefined && sharedPool
      ? createPostgresServiceCatalogRepository(sharedPool)
      : options.serviceCatalogRepository;
  const organizationRepository =
    options.organizationRepository === undefined && sharedPool
      ? createPostgresOrganizationRepository(sharedPool)
      : options.organizationRepository;
  const jobRepository =
    options.jobRepository === undefined && sharedPool
      ? createPostgresJobRepository(sharedPool)
      : options.jobRepository;
  const workforceRepository =
    options.workforceRepository === undefined && sharedPool
      ? createPostgresWorkforceRepository(sharedPool)
      : options.workforceRepository;
  const notificationsRepository =
    options.notificationsRepository === undefined && sharedPool
      ? createPostgresNotificationsRepository(sharedPool)
      : options.notificationsRepository;
  const marketingRepository =
    options.marketingRepository === undefined && sharedPool
      ? createPostgresMarketingRepository(sharedPool)
      : options.marketingRepository;
  const reportsRepository =
    options.reportsRepository === undefined && sharedPool
      ? createPostgresReportsRepository(sharedPool)
      : options.reportsRepository;
  const superAdminRepository =
    options.superAdminRepository === undefined
      ? createPostgresSuperAdminRepositoryFromEnv()
      : options.superAdminRepository;
  const readinessProbe =
    options.readinessProbe ||
    (sharedPool
      ? async () => {
          await sharedPool.query("SELECT 1");
          const migration = await sharedPool.query(
            `
              SELECT version
              FROM schema_migrations
              WHERE version = $1 AND status = 'applied'
              LIMIT 1
            `,
            ["0055_supabase_readiness_schema_migrations_rls.sql"],
          );
          if (migration.rowCount !== 1) {
            const error = new Error("Required migrations are not applied.");
            error.code = "MIGRATIONS_NOT_READY";
            throw error;
          }
          return {
            requiredMigration: "0055_supabase_readiness_schema_migrations_rls.sql",
            providers: validateProviderReadiness(process.env),
          };
        }
      : null);
  const server = createRuntimeServer({
    ...options,
    authService,
    attendanceRepository,
    financeRepository,
    assetsRepository,
    invoiceRepository,
    crmRepository,
    documentsRepository,
    estimateRepository,
    serviceCatalogRepository,
    organizationRepository,
    jobRepository,
    workforceRepository,
    notificationsRepository,
    marketingRepository,
    reportsRepository,
    superAdminRepository,
    sessionContextResolver: options.sessionContextResolver || authService?.sessionContextResolver,
    readinessProbe,
  });

  if (authService?.close) {
    server.on("close", () => {
      void authService.close();
    });
  }

  if (sharedPool && options.postgresPool === undefined) {
    server.on("close", () => {
      void sharedPool.end();
    });
  }

  if (attendanceRepository?.close) {
    server.on("close", () => {
      void attendanceRepository.close();
    });
  }

  if (financeRepository?.close) {
    server.on("close", () => {
      void financeRepository.close();
    });
  }

  if (assetsRepository?.close) {
    server.on("close", () => {
      void assetsRepository.close();
    });
  }

  if (invoiceRepository?.close) {
    server.on("close", () => {
      void invoiceRepository.close();
    });
  }

  if (crmRepository?.close) {
    server.on("close", () => {
      void crmRepository.close();
    });
  }

  if (documentsRepository?.close) {
    server.on("close", () => {
      void documentsRepository.close();
    });
  }

  if (estimateRepository?.close) {
    server.on("close", () => {
      void estimateRepository.close();
    });
  }

  if (serviceCatalogRepository?.close) {
    server.on("close", () => {
      void serviceCatalogRepository.close();
    });
  }

  if (organizationRepository?.close) {
    server.on("close", () => {
      void organizationRepository.close();
    });
  }

  if (jobRepository?.close) {
    server.on("close", () => {
      void jobRepository.close();
    });
  }

  if (notificationsRepository?.close) {
    server.on("close", () => {
      void notificationsRepository.close();
    });
  }

  if (marketingRepository?.close) {
    server.on("close", () => {
      void marketingRepository.close();
    });
  }

  if (reportsRepository?.close) {
    server.on("close", () => {
      void reportsRepository.close();
    });
  }

  if (superAdminRepository?.close) {
    server.on("close", () => {
      void superAdminRepository.close();
    });
  }

  if (workforceRepository?.close) {
    server.on("close", () => {
      void workforceRepository.close();
    });
  }

  server.listen(port, host, () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    process.stdout.write(`ConstructFlow API runtime listening on http://${host}:${actualPort}\n`);
    if (sharedPool) {
      void warmPostgresPool(sharedPool);
    }
  });

  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startRuntimeServer();
}
