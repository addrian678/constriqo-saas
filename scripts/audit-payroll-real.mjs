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

const migration = readProjectFile("database/migrations/0057_attendance_payroll_runtime.sql");
const hardeningMigration = readProjectFile("database/migrations/0062_payroll_integrity_hardening.sql");
const repository = readProjectFile("server/runtime/postgresPayrollRepository.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const routes = readProjectFile("server/runtime/runtimeRoutes.mjs");
const manifest = readProjectFile("server/runtime/runtimeManifest.mjs");
const apiClient = readProjectFile("src/modules/payroll/api/payrollClient.ts");
const page = readProjectFile("src/modules/payroll/pages/PayrollRealPage.tsx");
const workspace = readProjectFile("src/app/ProductionWorkspace.tsx");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("Migration crea tablas de nomina", migration.includes("CREATE TABLE IF NOT EXISTS payroll_worker_settings") && migration.includes("CREATE TABLE IF NOT EXISTS payroll_payments"), "tables");
check("Migration agrega estado pagado a asistencia", migration.includes("payroll_status") && migration.includes("payroll_payment_id"), "attendance payroll columns");
check("Migration blinda tenant con RLS", migration.includes("ENABLE ROW LEVEL SECURITY") && migration.includes("policy_name := table_name || '_tenant_isolation'"), "rls");
check("Migration evita doble pago de jornada", hardeningMigration.includes("uq_payroll_payment_entries_tenant_time_entry") && hardeningMigration.includes("idx_time_entries_tenant_worker_unpaid_closed"), "payment uniqueness");
check("Migration otorga permisos por rol", migration.includes("payroll.read") && migration.includes("payroll.manage") && migration.includes("r.code = 'admin'"), "capabilities");
check("Repository usa tenant context", repository.includes("set_config('app.tenant_id'") && !repository.includes("input.tenantId"), "tenant context");
check("Repository bloquea jornadas pendientes antes de pagar", repository.includes("lockPendingTimeEntriesForPayment") && repository.includes("FOR UPDATE"), "payment lock");
check("Repository calcula horas netas", repository.includes("payableSeconds") && repository.includes("breakSeconds") && repository.includes("clock_out - te.clock_in"), "hours");
check("Repository marca jornadas pagadas", repository.includes("payroll_status = 'paid'") && repository.includes("payroll_payment_time_entries"), "paid state");
check("Repository publica egreso financiero", repository.includes("'cash_out'") && repository.includes("'payroll_payment'"), "finance link");
check("Repository escribe auditoria", repository.includes("INSERT INTO audit_events") && repository.includes("payroll.payment.created"), "audit");
check("Runtime importa payroll repository", server.includes("createPostgresPayrollRepository(sharedPool)"), "runtime repo");
check("Runtime conecta handler payroll", server.includes("handlePayrollRoute") && server.includes('route.moduleId === "payroll"'), "handler");
check("Rutas payroll declaradas", routes.includes("/api/payroll/workers") && routes.includes("/api/payroll/workers/:workerId/payments"), "routes");
check("Manifest incluye payroll", manifest.includes('"payroll"') && manifest.includes("/api/payroll/workers"), "manifest");
check("Frontend API real", apiClient.includes("listPayrollWorkers") && apiClient.includes("createPayrollPayment"), "api client");
check("Pagina usa modales y no mock", page.includes("BasicModal") && !page.includes("mock-data") && page.includes("Nomina pagada"), "page");
check("Pagina usa tarjetas legibles con etiquetas", page.includes("payroll-record-card") && page.includes("Horas por pagar") && page.includes("Total por pagar"), "record cards");
check("Workspace incluye modulo nomina", workspace.includes("<PayrollRealPage") && workspace.includes('label: "Nomina"'), "workspace");
check("Package script audit:payroll-real", Boolean(packageJson.scripts?.["audit:payroll-real"]), "audit script");
check("Package script audit:payroll-integrity-real", Boolean(packageJson.scripts?.["audit:payroll-integrity-real"]), "real integrity audit script");
check("Verify incluye audit:payroll-real", String(packageJson.scripts?.verify).includes("audit:payroll-real"), "verify");

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Payroll real audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Payroll real audit passed with ${checks.length} checks.`);
