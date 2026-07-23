import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
let failures = 0;

function readProjectFile(relativePath) {
  const absolutePath = join(root, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`ok - ${name}`);
    return;
  }
  failures += 1;
  console.error(`not ok - ${name}${detail ? ` (${detail})` : ""}`);
}

const migration = readProjectFile("database/migrations/0052_document_storage_persistence.sql");
const storageRuntime = readProjectFile("server/runtime/storageRuntime.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const estimateRepo = readProjectFile("server/runtime/postgresEstimateRepository.mjs");
const invoiceRepo = readProjectFile("server/runtime/postgresInvoiceRepository.mjs");
const documentsRepo = readProjectFile("server/runtime/postgresDocumentsRepository.mjs");
const runbook = readProjectFile("docs/runbooks/domain-supabase-email-storage.md");
const envExample = readProjectFile(".env.example");
const smoke = readProjectFile("scripts/storage-local-smoke.mjs");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("Migration registra persistencia fisica", migration.includes("storage_provider") && migration.includes("storage_uploaded_at") && migration.includes("storage_checksum_sha256"), "0052");
check("Runtime storage escribe local-dev", storageRuntime.includes("writeLocalDevObject") && storageRuntime.includes("LOCAL_STORAGE_ROOT"), "local-dev");
check("Runtime storage sube Supabase", storageRuntime.includes("/storage/v1/object/") && storageRuntime.includes("SUPABASE_SERVICE_ROLE_KEY") && storageRuntime.includes('"x-upsert"'), "supabase");
check("Runtime storage calcula checksum", storageRuntime.includes("createHash") && storageRuntime.includes("sha256"), "checksum");
check("Runtime storage no permite path traversal", storageRuntime.includes("STORAGE_PATH_INVALID") && storageRuntime.includes("startsWith"), "path traversal");
check("Server persiste PDFs generados", server.includes("persistGeneratedPdf") && server.includes("storeGeneratedDocumentBuffer"), "server");
check("Estimate repo registra storage", estimateRepo.includes("recordGeneratedDocumentStorage") && estimateRepo.includes("documents.storage.persisted"), "estimate repo");
check("Invoice repo registra storage", invoiceRepo.includes("recordGeneratedDocumentStorage") && invoiceRepo.includes("documents.storage.persisted"), "invoice repo");
check("Documents repo expone metadata storage", documentsRepo.includes("storageProvider") && documentsRepo.includes("storageChecksumSha256") && documentsRepo.includes("storagePersisted"), "documents repo");
check("Readiness exige migracion productiva vigente", server.includes("0057_attendance_payroll_runtime.sql") && server.includes("SUPABASE_STORAGE_SECRETS"), "readiness");
check("Env documenta local storage", envExample.includes("LOCAL_STORAGE_ROOT") && envExample.includes("SUPABASE_SERVICE_ROLE_KEY"), ".env.example");
check("Runbook exige migracion actual", runbook.includes("0052_document_storage_persistence.sql") && runbook.includes("Supabase Storage"), "runbook");
check("Smoke local valida storage", smoke.includes("storeGeneratedDocumentBuffer") && smoke.includes("local-dev storage writes file"), "smoke");
check("Package registra auditoria storage", Boolean(packageJson.scripts?.["audit:storage-real"]) && String(packageJson.scripts?.verify).includes("audit:storage-real"), "package audit");
check("Package registra smoke storage", Boolean(packageJson.scripts?.["smoke:storage-local"]), "package smoke");

if (failures > 0) {
  console.error(`Storage real audit failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log("Storage real audit passed.");
