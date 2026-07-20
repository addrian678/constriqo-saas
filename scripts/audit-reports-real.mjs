import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

function readProjectFile(path) {
  const fullPath = join(root, path);
  check(`Archivo requerido ${path}`, existsSync(fullPath), path);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

const migration = readProjectFile("database/migrations/0035_reports_runtime.sql");
const repository = readProjectFile("server/runtime/postgresReportsRepository.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const routes = readProjectFile("server/runtime/runtimeRoutes.mjs");
const apiClient = readProjectFile("src/modules/reports/api/reportsClient.ts");
const page = readProjectFile("src/modules/reports/pages/ReportsRealPage.tsx");
const workspace = readProjectFile("src/app/ProductionWorkspace.tsx");
const workerWorkspace = readProjectFile("src/app/WorkerProductionWorkspace.tsx");
const localSmoke = readProjectFile("scripts/reports-local-smoke.mjs");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("Migration registra reports.read", migration.includes("reports.read") && migration.includes("WHERE r.code IN ('admin', 'manager')"), "capability");
check("Repository activa tenant context", repository.includes("set_config('app.tenant_id'"), "tenant context");
check("Repository consulta finanzas reales", repository.includes("FROM invoices") && repository.includes("FROM expenses") && repository.includes("FROM assets"), "finance");
check("Repository consulta operaciones reales", repository.includes("FROM jobs") && repository.includes("FROM job_tasks") && repository.includes("FROM workers"), "operations");
check("Repository consulta marketing y control", repository.includes("marketing_loyalty_cards") && repository.includes("audit_events") && repository.includes("notification_queue"), "marketing control");
check("Repository no toma tenant desde input", !repository.includes("input.tenantId") && !repository.includes("body.tenantId"), "no tenant input");

check("Runtime importa reports repository con pool compartido", server.includes("createPostgresReportsRepository(sharedPool)"), "shared pool import");
check("Runtime conecta reports", server.includes("handleReportsRoute") && server.includes('route.moduleId === "reports"'), "handler");
check("Runtime devuelve 503 si falta repository", server.includes("REPORTS_REPOSITORY_NOT_CONFIGURED"), "503");
check("Ruta reports summary", routes.includes("/api/reports/summary") && routes.includes('capability: "reports.read"'), "route");

check("API cubre getReportsSummary", apiClient.includes("getReportsSummary") && apiClient.includes("/api/reports/summary"), "api");
check("Pagina no usa mock data", !page.includes("mock-data") && !page.includes("visualReports"), "no mock");
check("Pagina no descarga ni imprime", !page.includes("download") && !page.includes("print"), "no export");
check("Workspace expone reportes reales", workspace.includes("<ReportsRealPage") && workspace.includes('label: "Reportes"'), "workspace");
check("Worker workspace no expone reportes", !workerWorkspace.includes("ReportsRealPage") && !workerWorkspace.includes('label: "Reportes"'), "worker isolation");

check("Smoke valida aislamiento", localSmoke.includes("Tenant B no ve datos A"), "isolation smoke");
check("Package script audit:reports-real", Boolean(packageJson.scripts?.["audit:reports-real"]), "audit script");
check("Package script smoke:reports-local", Boolean(packageJson.scripts?.["smoke:reports-local"]), "smoke script");

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Reports real audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Reports real audit passed with ${checks.length} checks.`);
