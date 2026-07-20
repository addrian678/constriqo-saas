import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function readProjectFile(path) {
  const fullPath = join(root, path);
  check(`Archivo requerido ${path}`, existsSync(fullPath), path);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

const migration = readProjectFile("database/migrations/0036_documents_runtime.sql");
const archiveMigration = readProjectFile("database/migrations/0039_document_archive_workflow.sql");
const cleanupMigration = readProjectFile("database/migrations/0040_document_secure_cleanup.sql");
const usageMigration = readProjectFile("database/migrations/0042_tenant_usage_quotas.sql");
const repository = readProjectFile("server/runtime/postgresDocumentsRepository.mjs");
const storageRuntime = readProjectFile("server/runtime/storageRuntime.mjs");
const estimateRepo = readProjectFile("server/runtime/postgresEstimateRepository.mjs");
const invoiceRepo = readProjectFile("server/runtime/postgresInvoiceRepository.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const routes = readProjectFile("server/runtime/runtimeRoutes.mjs");
const manifest = readProjectFile("server/runtime/runtimeManifest.mjs");
const apiClient = readProjectFile("src/modules/documents/api/documentsClient.ts");
const page = readProjectFile("src/modules/documents/pages/DocumentsRealPage.tsx");
const workspace = readProjectFile("src/app/ProductionWorkspace.tsx");
const smoke = readProjectFile("scripts/documents-local-smoke.mjs");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("Migration documentos runtime existe", migration.includes("documents.read") && migration.includes("documents.create"), "0036");
check("Migration archivo semestral existe", archiveMigration.includes("documents.archive") && archiveMigration.includes("archive_batch_id"), "0039");
check("Migration archivo no borra metadata", archiveMigration.includes("archived_at") && archiveMigration.includes("archive_note"), "archive metadata");
check("Migration limpieza segura existe", cleanupMigration.includes("documents.cleanup") && cleanupMigration.includes("heavy_file_cleaned_at"), "0040");
check("Migration limpieza conserva storage original", cleanupMigration.includes("heavy_file_original_storage_key") && cleanupMigration.includes("heavy_file_cleanup_cutoff_at"), "cleanup metadata");
check("Capability limpieza solo admin", cleanupMigration.includes("WHERE r.code = 'admin'") && !cleanupMigration.includes("r.code IN ('admin', 'manager')"), "admin only");
check("Migration agrega tamano para cuota", usageMigration.includes("storage_size_bytes") && usageMigration.includes("tenant_usage_limits"), "usage quota");

check("Repository activa tenant context", repository.includes("set_config('app.tenant_id'"), "tenant context");
check("Repository lista documentos", repository.includes("listDocuments") && repository.includes("WHERE tenant_id = $1"), "list");
check("Repository guarda tamano archivo", repository.includes("storage_size_bytes") && repository.includes("storageSizeBytes"), "storage size");
check("Runtime storage prepara Supabase/S3", storageRuntime.includes("supabase-storage") && storageRuntime.includes("s3-compatible") && storageRuntime.includes("buildGeneratedStorageKey"), "storage runtime");
check("PDFs generados usan storage provider", estimateRepo.includes("buildGeneratedStorageKey") && invoiceRepo.includes("buildGeneratedStorageKey"), "generated storage keys");
check("Repository bloquea por cuota", repository.includes("enforceDocumentQuota") && repository.includes("TENANT_STORAGE_LIMIT_REACHED"), "quota");
check("Repository soporta generated", repository.includes('"generated"') && repository.includes("status = 'archived'"), "generated/archive");
check("Repository calcula plan semestral", repository.includes("getArchivePlan") && repository.includes("interval '6 months'"), "archive plan");
check("Repository confirma archivo con auditoria", repository.includes("markArchiveCompleted") && repository.includes("documents.archive.completed"), "archive complete");
check("Repository calcula limpieza por primer uso", repository.includes("getCleanupStatus") && repository.includes("auth_sessions") && repository.includes("first_use_at"), "cleanup status");
check("Repository exige archivo antes de limpiar", repository.includes("status = 'archived'") && repository.includes("requiresArchiveCount"), "archive before cleanup");
check("Repository limpieza requiere MFA real", repository.includes("verifyCleanupAuthorization") && repository.includes("verifyPassword") && repository.includes("verifyTotpCode") && repository.includes("decryptSecret"), "reauth mfa");
check("Repository limpieza no borra filas", repository.includes("storage_key = NULL") && !repository.includes("DELETE FROM documents"), "no row delete");
check("Repository audita limpieza", repository.includes("documents.heavy_file_cleanup.completed") && repository.includes("document_cleanup_batch"), "cleanup audit");
check("Repository crea notificacion de archivo", repository.includes("notification_queue") && repository.includes("Archivo semestral confirmado"), "notification");
check("Repository crea notificacion de limpieza", repository.includes("Limpieza segura completada"), "cleanup notification");
check("Repository no toma tenant desde input", !repository.includes("input.tenantId") && !repository.includes("body.tenantId"), "no tenant input");

check("Runtime conecta rutas documento", server.includes("handleDocumentsRoute") && server.includes("cleanup-heavy-files"), "runtime");
check("Rutas incluyen archivo semestral", routes.includes("/api/documents/archive-plan") && routes.includes("/api/documents/archive-complete") && routes.includes("documents.archive"), "routes archive");
check("Rutas incluyen limpieza segura", routes.includes("/api/documents/cleanup-status") && routes.includes("/api/documents/cleanup-heavy-files") && routes.includes("documents.cleanup"), "routes cleanup");
check("Manifest incluye archivo semestral", manifest.includes("/api/documents/archive-plan") && manifest.includes("/api/documents/archive-complete"), "manifest archive");
check("Manifest incluye limpieza segura", manifest.includes("/api/documents/cleanup-status") && manifest.includes("/api/documents/cleanup-heavy-files"), "manifest cleanup");

check("API client cubre archivo", apiClient.includes("getDocumentArchivePlan") && apiClient.includes("markDocumentArchiveCompleted"), "api");
check("API client cubre limpieza", apiClient.includes("getDocumentCleanupStatus") && apiClient.includes("cleanupArchivedHeavyFiles"), "api cleanup");
check("Pagina no usa mock data", !page.includes("mock-data") && !page.includes("visualDocuments"), "no mock");
check("Pagina muestra archivo semestral", page.includes("Archivo semestral") && page.includes("Confirmar archivo descargado"), "ui");
check("Pagina muestra tamano aproximado", page.includes("Tamano aproximado MB") && page.includes("formatMb"), "size UI");
check("Pagina conserva registros", page.includes("metadata como archivada") && page.includes("No se guardo ningun archivo pesado"), "copy");
check("Pagina muestra limpieza 2FA", page.includes("Limpieza segura") && page.includes("Codigo de 6 digitos") && page.includes("Eliminar archivos pesados archivados"), "ui cleanup");
check("Pagina recomienda respaldo externo", page.includes("PC o memoria externa") && page.includes("telefono"), "external backup");
check("Workspace muestra alerta global", workspace.includes("global-retention-banner") && workspace.includes("getDocumentCleanupStatus") && workspace.includes('selectModule("documents")'), "global banner");

check("Smoke valida aislamiento", smoke.includes("Tenant B no ve plan A"), "isolation");
check("Smoke valida confirmacion", smoke.includes("Tenant A confirma archivo"), "confirm");
check("Smoke valida limpieza MFA", smoke.includes("Tenant A limpia archivo pesado") && smoke.includes("generateCurrentTotpCode"), "cleanup smoke");
check("Smoke valida bloqueo por cuota", smoke.includes("Tenant A bloquea documento por cuota") && smoke.includes("TENANT_STORAGE_LIMIT_REACHED"), "quota smoke");
check("Package script audit:documents-real", Boolean(packageJson.scripts?.["audit:documents-real"]), "audit script");
check("Package script smoke:documents-local", Boolean(packageJson.scripts?.["smoke:documents-local"]), "smoke script");
check("Verify incluye audit:documents-real", String(packageJson.scripts?.verify).includes("audit:documents-real"), "verify");

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Documents real audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Documents real audit passed with ${checks.length} checks.`);
