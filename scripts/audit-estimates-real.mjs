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

const repository = readProjectFile("server/runtime/postgresEstimateRepository.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const routes = readProjectFile("server/runtime/runtimeRoutes.mjs");
const apiClient = readProjectFile("src/modules/estimates/api/estimateClient.ts");
const page = readProjectFile("src/modules/estimates/pages/EstimatesRealPage.tsx");
const workspace = readProjectFile("src/app/ProductionWorkspace.tsx");
const localSmoke = readProjectFile("scripts/estimates-local-smoke.mjs");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("Estimates repository activa tenant context", repository.includes("set_config('app.tenant_id'"), "app.tenant_id");
check("Estimates repository escribe auditoria", repository.includes("INSERT INTO audit_events") && repository.includes("estimates.created"), "audit_events");
check("Estimates repository valida cliente tenant", repository.includes("requireClientForTenant"), "requireClientForTenant");
check("Estimates repository calcula totales", repository.includes("calculateTotals") && repository.includes("taxRate"), "calculateTotals");
check("Estimates repository archiva PDF generado", repository.includes("archiveEstimatePdf") && repository.includes("upsertGeneratedDocument"), "archive pdf");
check("Estimates repository registra tamano PDF", repository.includes("storage_size_bytes") && repository.includes("storageSizeBytes"), "pdf size");
check("Estimates repository no toma tenant desde input", !repository.includes("input.tenantId") && !repository.includes("body.tenantId"), "no input tenant");

check("Runtime importa estimate repository con pool compartido", server.includes("createPostgresEstimateRepository(sharedPool)"), "createPostgresEstimateRepository(sharedPool)");
check("Runtime conecta handler estimates", server.includes("handleEstimateRoute") && server.includes('route.moduleId === "estimates"'), "handleEstimateRoute");
check("Runtime archiva PDF de cotizacion", server.includes("archiveEstimatePdf") && server.includes("createEstimatePdfBuffer"), "runtime pdf archive");
check("Runtime devuelve 503 si estimates no esta conectado", server.includes("ESTIMATE_REPOSITORY_NOT_CONFIGURED"), "ESTIMATE_REPOSITORY_NOT_CONFIGURED");

check("Rutas estimates incluyen detalle", routes.includes('/api/estimates/:estimateId'), "detail");
check("Rutas estimates incluyen patch", routes.includes('method: "PATCH"') && routes.includes("estimates.update"), "PATCH");
check("Rutas estimates incluyen version", routes.includes('/api/estimates/:estimateId/versions'), "versions");
check("Rutas estimates incluyen approve", routes.includes('/api/estimates/:estimateId/approve'), "approve");

check("Estimates API no envia tenantId", !apiClient.includes("tenantId"), "tenant from session only");
check("Estimates API cubre crear/listar/detalle", apiClient.includes("createEstimate") && apiClient.includes("listEstimates") && apiClient.includes("getEstimate"), "api coverage");
check("Estimates API cubre aprobar", apiClient.includes("approveEstimate"), "approve");

check("Estimates real page no importa mock data", !page.includes("mock-data") && !page.includes("estimatesData"), "no mock imports");
check("Estimates real page tiene estado vacio", page.includes("Sin cotizaciones todavia"), "empty state");
check("Estimates real page selecciona clientes reales", page.includes("listCrmClients"), "listCrmClients");
check("Estimates real page crea cotizacion", page.includes("handleCreateEstimate") && page.includes("createEstimate"), "create");
check("Estimates real page aprueba cotizacion", page.includes("handleApprove") && page.includes("approveEstimate"), "approve");
check("Estimates real page calcula totales de formulario", page.includes("formSubtotal") && page.includes("formTotal"), "form totals");
check("Estimates real page abre PDF real para impresion", page.includes("openBlobInDocumentViewer") && page.includes("PDF real abierto para imprimir") && page.includes("Abrir PDF"), "real pdf print");
check("Estimates real page etiqueta partidas en movil", page.includes("line-item-mobile-heading") && page.includes("aria-label={`Cantidad de partida") && page.includes("placeholder=\"Precio unitario\""), "mobile item labels");
check("Estimates real page convierte aprobada en factura", page.includes("handleCreateInvoiceFromEstimate") && page.includes("createInvoice(session.sessionToken") && page.includes("Crear factura para cobrar"), "estimate to invoice");
check("Estimates real page muestra detalle en modal", page.includes("Detalle de cotizacion") && page.includes("document-detail-modal") && page.includes("setSelectedEstimateId(null)"), "detail modal");
check("Estimates real page permite agregar partida al final", page.includes("line-item-bottom-actions") && page.includes("Agregar otra partida"), "bottom add item");

check("Workspace productivo incluye CRM y cotizaciones", workspace.includes("<CrmRealPage") && workspace.includes("<EstimatesRealPage"), "workspace modules");
check("Production workspace no importa mock data", !workspace.includes("mock-data"), "no mock imports");

check("Estimates local smoke crea dos tenants", localSmoke.includes("tenantA") && localSmoke.includes("tenantB"), "tenant fixtures");
check("Estimates local smoke valida aislamiento", localSmoke.includes("Tenant B no ve cotizacion de tenant A"), "tenant isolation");
check("Estimates local smoke valida PDF archivado", localSmoke.includes("Tenant A descarga PDF cotizacion") && localSmoke.includes("PDF cotizacion queda archivado con tamano"), "pdf smoke");
check("Estimates local smoke limpia fixtures", localSmoke.includes("DELETE FROM estimates") && localSmoke.includes("DELETE FROM tenants"), "cleanup");

check("Package script audit:estimates-real", Boolean(packageJson.scripts?.["audit:estimates-real"]), "audit:estimates-real");
check("Package script smoke:estimates-local", Boolean(packageJson.scripts?.["smoke:estimates-local"]), "smoke:estimates-local");
check("Verify incluye audit:estimates-real", String(packageJson.scripts?.verify).includes("audit:estimates-real"), "verify");

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Estimates real audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Estimates real audit passed with ${checks.length} checks.`);
