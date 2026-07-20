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

const migration = readProjectFile("database/migrations/0026_finance_expenses_runtime.sql");
const correctionMigration = readProjectFile("database/migrations/0043_finance_transaction_corrections.sql");
const repository = readProjectFile("server/runtime/postgresFinanceRepository.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const routes = readProjectFile("server/runtime/runtimeRoutes.mjs");
const manifest = readProjectFile("server/runtime/runtimeManifest.mjs");
const apiClient = readProjectFile("src/modules/finance/api/financeClient.ts");
const page = readProjectFile("src/modules/finance/pages/FinanceRealPage.tsx");
const workspace = readProjectFile("src/app/ProductionWorkspace.tsx");
const workerWorkspace = readProjectFile("src/app/WorkerProductionWorkspace.tsx");
const localSmoke = readProjectFile("scripts/finance-local-smoke.mjs");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("Migration amplia gastos", migration.includes("expense_number") && migration.includes("tax_amount") && migration.includes("currency"), "expense fields");
check("Migration amplia financial transactions", migration.includes("direction text") && migration.includes("description text"), "ledger fields");
check("Migration otorga permisos por rol", migration.includes("finance.read") && migration.includes("expenses.approve") && migration.includes("r.code = 'manager'"), "role grants");
check("Migration soporta correcciones contables", correctionMigration.includes("corrected_by_transaction_id") && correctionMigration.includes("reversed_transaction_id"), "correction columns");

check("Finance repository activa tenant context", repository.includes("set_config('app.tenant_id'"), "tenant context");
check("Finance repository crea proveedores", repository.includes("createVendor") && repository.includes("vendors"), "vendors");
check("Finance repository crea gastos", repository.includes("createExpense") && repository.includes("expense_items"), "expenses");
check("Finance repository contabiliza ledger", repository.includes("postExpenseLedger") && repository.includes("financial_transactions"), "ledger");
check("Finance repository corrige sin borrar", repository.includes("correctManualTransaction") && repository.includes("finance.transaction.corrected") && repository.includes("oppositeDirection"), "corrections");
check("Finance repository calcula dashboard", repository.includes("getDashboard") && repository.includes("periodSummary"), "dashboard");
check("Finance repository no toma tenant desde input", !repository.includes("input.tenantId") && !repository.includes("body.tenantId"), "no tenant input");
check("Finance repository escribe auditoria", repository.includes("INSERT INTO audit_events") && repository.includes("expenses.created"), "audit");

check("Runtime importa finance repository con pool compartido", server.includes("createPostgresFinanceRepository(sharedPool)"), "shared pool import");
check("Runtime conecta expenses", server.includes("handleExpenseRoute") && server.includes('route.moduleId === "expenses"'), "expenses handler");
check("Runtime conecta finance", server.includes("handleFinanceRoute") && server.includes('route.moduleId === "finance"'), "finance handler");
check("Runtime devuelve 503 si no conectado", server.includes("FINANCE_REPOSITORY_NOT_CONFIGURED"), "503");

check("Rutas expenses reales", routes.includes("/api/expenses/vendors") && routes.includes("/api/expenses/:expenseId/payments"), "expense routes");
check("Rutas finance dashboard", routes.includes("/api/finance/dashboard") && routes.includes("/api/finance/transactions"), "finance routes");
check("Rutas finance correccion", routes.includes("/api/finance/transactions/:transactionId/correct"), "correction route");
check("Manifest incluye rutas finance", manifest.includes("/api/finance/dashboard") && manifest.includes("/api/expenses/vendors"), "manifest");

check("Finance API cubre dashboard y gastos", apiClient.includes("getFinanceDashboard") && apiClient.includes("createExpense"), "api");
check("Finance API cubre proveedores y pagos", apiClient.includes("createVendor") && apiClient.includes("recordExpensePayment"), "api payments");
check("Finance API cubre correcciones", apiClient.includes("correctManualTransaction"), "api corrections");

check("Finance page no usa mock data", !page.includes("mock-data") && !page.includes("financeData"), "no mock");
check("Finance page crea gastos reales", page.includes("handleCreateExpense") && page.includes("createExpense"), "create expense");
check("Finance page corrige movimientos", page.includes("handleCorrectManualTransaction") && page.includes("openCorrection") && page.includes("Reverso + nuevo registro"), "correction ui");
check("Finance page muestra dashboard real", page.includes("summary.income") && page.includes("dashboard.periods"), "dashboard ui");
check("Workspace incluye finanzas reales", workspace.includes("<FinanceRealPage") && workspace.includes('label: "Finanzas"'), "workspace");
check("Worker workspace no expone finanzas", !workerWorkspace.includes("FinanceRealPage") && !workerWorkspace.includes("Finanzas"), "worker isolation");

check("Finance smoke valida aislamiento", localSmoke.includes("Tenant B no ve gasto A"), "isolation");
check("Finance smoke valida ledger", localSmoke.includes("Gasto genera ledger"), "ledger smoke");
check("Finance smoke valida correcciones", localSmoke.includes("Movimiento manual se corrige con reverso") && localSmoke.includes("Original queda marcado corregido"), "correction smoke");
check("Package script audit:finance-real", Boolean(packageJson.scripts?.["audit:finance-real"]), "audit script");
check("Package script smoke:finance-local", Boolean(packageJson.scripts?.["smoke:finance-local"]), "smoke script");
check("Verify incluye audit:finance-real", String(packageJson.scripts?.verify).includes("audit:finance-real"), "verify");

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Finance real audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Finance real audit passed with ${checks.length} checks.`);
