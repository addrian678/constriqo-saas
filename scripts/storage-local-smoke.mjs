import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { buildGeneratedStorageKey, storeGeneratedDocumentBuffer } from "../server/runtime/storageRuntime.mjs";

const checks = [];

function check(name, passed, details = "") {
  checks.push({ name, passed, details });
}

const root = process.cwd();
const localRoot = join(root, ".local-data", "storage-smoke");
await rm(localRoot, { recursive: true, force: true });

const tenantId = "tenant-storage-smoke";
const documentId = "document-storage-smoke";
const buffer = Buffer.from("%PDF-1.4\n% storage smoke\n", "utf8");
const storageKey = buildGeneratedStorageKey(
  {
    tenantId,
    documentType: "invoice_pdf",
    relatedEntityType: "invoice",
    relatedEntityId: documentId,
    filename: "smoke.pdf",
  },
  {
    STORAGE_PROVIDER: "local-dev",
    STORAGE_BUCKET_DOCUMENTS: "constriqo-documents",
  },
);

const result = await storeGeneratedDocumentBuffer(
  {
    documentId,
    storageKey,
  },
  buffer,
  {
    env: {
      STORAGE_PROVIDER: "local-dev",
      STORAGE_BUCKET_DOCUMENTS: "constriqo-documents",
      LOCAL_STORAGE_ROOT: localRoot,
    },
  },
);

check("local-dev storage writes file", result.persisted === true && result.provider === "local-dev" && existsSync(result.localPath), JSON.stringify(result));
check("local-dev storage keeps bytes", readFileSync(result.localPath).equals(buffer), result.localPath || "");
check("local-dev storage computes checksum", /^[a-f0-9]{64}$/u.test(result.checksumSha256), result.checksumSha256);

const metadataOnly = await storeGeneratedDocumentBuffer(
  { documentId: "metadata-only", storageKey: "generated://invoice/metadata-only.pdf" },
  buffer,
  { env: { STORAGE_PROVIDER: "not-configured" } },
);
check("not-configured storage keeps metadata only", metadataOnly.persisted === false && metadataOnly.provider === "not-configured", JSON.stringify(metadataOnly));

let traversalBlocked = false;
try {
  await storeGeneratedDocumentBuffer(
    { documentId: "bad", storageKey: "local-dev://constriqo-documents/../../bad.pdf" },
    buffer,
    { env: { STORAGE_PROVIDER: "local-dev", LOCAL_STORAGE_ROOT: localRoot } },
  );
} catch (error) {
  traversalBlocked = error.code === "STORAGE_PATH_INVALID";
}
check("local-dev storage blocks path traversal", traversalBlocked, "path traversal");

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Storage local smoke failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`not ok - ${item.name}${item.details ? ` (${item.details})` : ""}`);
  }
  process.exit(1);
}

for (const item of checks) {
  console.log(`ok - ${item.name}`);
}
console.log("Storage local smoke passed.");
