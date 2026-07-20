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

const repository = readProjectFile("server/runtime/postgresCrmRepository.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const routes = readProjectFile("server/runtime/runtimeRoutes.mjs");
const authClient = readProjectFile("src/app/auth/authClient.ts");
const apiClient = readProjectFile("src/modules/crm/api/crmClient.ts");
const crmPage = readProjectFile("src/modules/crm/pages/CrmRealPage.tsx");
const productionApp = readProjectFile("src/app/ProductionApp.tsx");
const productionWorkspace = readProjectFile("src/app/ProductionWorkspace.tsx");
const localSmoke = readProjectFile("scripts/crm-local-smoke.mjs");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("CRM repository activa tenant context", repository.includes("set_config('app.tenant_id'"), "app.tenant_id");
check("CRM repository escribe auditoria", repository.includes("INSERT INTO audit_events") && repository.includes("crm.clients.created"), "audit_events");
check("CRM repository usa soft delete", repository.includes("archiveClient") && repository.includes("SET status = 'archived'"), "archiveClient");
check("CRM repository valida cliente dentro del tenant", repository.includes("requireClientForTenant"), "requireClientForTenant");
check("CRM repository no toma tenant desde input", !repository.includes("input.tenantId") && !repository.includes("body.tenantId"), "no input tenant");

check("Runtime importa CRM repository con pool compartido", server.includes("createPostgresCrmRepository(sharedPool)"), "createPostgresCrmRepository(sharedPool)");
check("Runtime conecta handler CRM", server.includes("handleCrmRoute") && server.includes('route.moduleId === "crm"'), "handleCrmRoute");
check("Runtime soporta DELETE por CORS", server.includes("GET,POST,PATCH,DELETE,OPTIONS"), "DELETE CORS");
check("Runtime devuelve 503 si CRM no esta conectado", server.includes("CRM_REPOSITORY_NOT_CONFIGURED"), "CRM_REPOSITORY_NOT_CONFIGURED");

check("Rutas CRM incluyen detalle", routes.includes('/api/crm/clients/:clientId'), "client detail");
check("Rutas CRM incluyen actualizar", routes.includes('method: "PATCH"') && routes.includes("clients.update"), "PATCH clients.update");
check("Rutas CRM incluyen archivar", routes.includes('method: "DELETE"') && routes.includes("clients.update"), "DELETE clients.update");
check("Rutas CRM incluyen notas", routes.includes('/api/crm/clients/:clientId/notes'), "notes");
check("Rutas runtime entregan params", routes.includes("params") && routes.includes("matchPath"), "route params");

check("Auth client exporta requestJson", authClient.includes("export async function requestJson"), "requestJson");
check("Auth client soporta PATCH", authClient.includes('"PATCH"'), "PATCH");
check("Auth client soporta DELETE", authClient.includes('"DELETE"'), "DELETE");

check("CRM API no envia tenantId", !apiClient.includes("tenantId"), "tenant from session only");
check("CRM API usa Bearer token", apiClient.includes("token") && apiClient.includes("requestJson"), "token");
check("CRM API cubre crear cliente", apiClient.includes("createCrmClient"), "createCrmClient");
check("CRM API cubre actualizar cliente", apiClient.includes("updateCrmClient"), "updateCrmClient");
check("CRM API cubre archivar cliente", apiClient.includes("archiveCrmClient"), "archiveCrmClient");
check("CRM API cubre notas y actividades", apiClient.includes("createCrmNote") && apiClient.includes("createCrmActivity"), "notes activities");

check("CRM real page no importa mock data", !crmPage.includes("mock-data") && !crmPage.includes("crmData"), "no mock imports");
check("CRM real page tiene estado vacio", crmPage.includes("Sin clientes todavia"), "empty state");
check("CRM real page permite crear", crmPage.includes("Crear cliente") && crmPage.includes("handleSaveClient"), "create form");
check("CRM real page permite editar", crmPage.includes("Guardar cambios") && crmPage.includes("updateCrmClient"), "update form");
check("CRM real page permite archivar", crmPage.includes("handleArchiveClient") && crmPage.includes("archiveCrmClient"), "archive");
check("CRM real page permite notas", crmPage.includes("handleCreateNote") && crmPage.includes("createCrmNote"), "notes");
check("CRM real page no contiene panel de desarrollo", !crmPage.toLowerCase().includes("demo desarrollo"), "no dev demo");

check(
  "ProductionApp renderiza workspace real despues de login",
  productionApp.includes("<ProductionWorkspace") && productionApp.includes("session={session}"),
  "ProductionWorkspace",
);
check("ProductionApp no importa rutas visuales", !productionApp.includes("AppRoutes") && !productionApp.includes("mock-data"), "no visual routes");
check("ProductionWorkspace incluye CRM real", productionWorkspace.includes("<CrmRealPage") && productionWorkspace.includes("embedded"), "CrmRealPage");
check("ProductionWorkspace no importa mock data", !productionWorkspace.includes("mock-data"), "no mock imports");

check("CRM local smoke crea dos tenants", localSmoke.includes("tenantA") && localSmoke.includes("tenantB"), "tenant fixtures");
check("CRM local smoke valida aislamiento", localSmoke.includes("Tenant B no ve cliente de tenant A"), "tenant isolation");
check("CRM local smoke limpia fixtures", localSmoke.includes("DELETE FROM tenants") && localSmoke.includes("DELETE FROM clients"), "cleanup");

check("Package script audit:crm-real", Boolean(packageJson.scripts?.["audit:crm-real"]), "audit:crm-real");
check("Package script smoke:crm-local", Boolean(packageJson.scripts?.["smoke:crm-local"]), "smoke:crm-local");
check("Verify incluye audit:crm-real", String(packageJson.scripts?.verify).includes("audit:crm-real"), "verify");

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`CRM real audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`CRM real audit passed with ${checks.length} checks.`);
