import { randomUUID } from "node:crypto";
import { buildGeneratedStorageKey, storeGeneratedDocumentBuffer } from "../server/runtime/storageRuntime.mjs";

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of required) {
  if (!String(process.env[key] || "").trim()) {
    console.error(`${key} is required for production storage smoke.`);
    process.exit(1);
  }
}

const env = {
  ...process.env,
  STORAGE_PROVIDER: "supabase-storage",
  STORAGE_BUCKET_DOCUMENTS: process.env.STORAGE_BUCKET_DOCUMENTS || "constriqo-documents",
};
const tenantId = process.env.STORAGE_SMOKE_TENANT_ID || "provider-storage-smoke";
const smokeId = randomUUID();
const filename = `storage-smoke-${new Date().toISOString().replace(/[:.]/gu, "-")}.pdf`;
const storageKey = buildGeneratedStorageKey(
  {
    tenantId,
    documentType: "storage_smoke",
    relatedEntityType: "readiness",
    relatedEntityId: smokeId,
    filename,
  },
  env,
);

const pdfBytes = Buffer.from(
  `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 180 80] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 45 >>
stream
BT /F1 12 Tf 20 40 Td (Constriqo storage smoke) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<< /Root 1 0 R /Size 5 >>
startxref
299
%%EOF`,
  "utf8",
);

const result = await storeGeneratedDocumentBuffer({ storageKey }, pdfBytes, { env, contentType: "application/pdf" });

if (!result.persisted || result.provider !== "supabase-storage" || !result.checksumSha256) {
  console.error(JSON.stringify({ status: "failed", result }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "ok",
  provider: result.provider,
  bucket: result.bucket,
  objectPath: result.objectPath,
  sizeBytes: result.sizeBytes,
  checksumSha256: result.checksumSha256,
}, null, 2));
