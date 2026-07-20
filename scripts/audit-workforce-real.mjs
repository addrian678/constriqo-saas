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

const repository = readProjectFile("server/runtime/postgresWorkforceRepository.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const routes = readProjectFile("server/runtime/runtimeRoutes.mjs");
const apiClient = readProjectFile("src/modules/workforce/api/workforceClient.ts");
const page = readProjectFile("src/modules/workforce/pages/WorkforceRealPage.tsx");
const workspace = readProjectFile("src/app/ProductionWorkspace.tsx");
const localSmoke = readProjectFile("scripts/workforce-local-smoke.mjs");
const workerUserSmoke = readProjectFile("scripts/worker-user-local-smoke.mjs");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("Workforce repository activa tenant context", repository.includes("set_config('app.tenant_id'"), "app.tenant_id");
check("Workforce repository escribe auditoria", repository.includes("INSERT INTO audit_events") && repository.includes("workforce.worker.created"), "audit_events");
check("Workforce repository valida usuario tenant", repository.includes("requireUserForTenant"), "requireUserForTenant");
check("Workforce repository valida trabajador tenant", repository.includes("requireWorkerForTenant"), "requireWorkerForTenant");
check("Workforce repository no toma tenant desde input", !repository.includes("input.tenantId") && !repository.includes("body.tenantId"), "no tenant input");
check("Workforce repository usa perfil worker", repository.includes("worker_profiles") && repository.includes("upsertProfile"), "profile");
check("Workforce repository crea usuario trabajador", repository.includes("createWorkerUser") && repository.includes("auth_password_credentials"), "worker user");
check("Workforce repository guarda password hash-only", repository.includes("argon2.hash") && repository.includes("passwordStored"), "hash only");
check("Workforce prepara email sandbox sin secreto", repository.includes("worker.temporary_access") && repository.includes("email_deliveries") && repository.includes("passwordPersisted: false"), "worker email");
check("Workforce repository asigna rol worker", repository.includes("code = 'worker'") && repository.includes("user_roles"), "worker role");

check("Runtime importa workforce repository con pool compartido", server.includes("createPostgresWorkforceRepository(sharedPool)"), "shared pool import");
check("Runtime conecta handler workforce", server.includes("handleWorkforceRoute") && server.includes('route.moduleId === "workforce"'), "handler");
check("Runtime devuelve 503 si workforce no conectado", server.includes("WORKFORCE_REPOSITORY_NOT_CONFIGURED"), "503");

check("Rutas workforce incluyen lista y detalle", routes.includes("/api/workforce/workers") && routes.includes("/api/workforce/workers/:workerId"), "routes");
check("Rutas workforce incluyen patch", routes.includes('method: "PATCH"') && routes.includes("workforce.manage"), "patch");
check("Rutas workforce incluyen creacion de usuario", routes.includes("/api/workforce/worker-users"), "worker user route");

check("Workforce API no envia tenantId", !apiClient.includes("tenantId"), "tenant from session");
check("Workforce API cubre crear/listar/detalle", apiClient.includes("createWorker") && apiClient.includes("listWorkers") && apiClient.includes("getWorker"), "api");
check("Workforce API cubre update", apiClient.includes("updateWorker"), "update");
check("Workforce API cubre usuario trabajador", apiClient.includes("createWorkerUser") && apiClient.includes("temporaryPassword"), "worker user api");

check("Workforce real page no importa mock data", !page.includes("mock-data") && !page.includes("workforceData"), "no mock");
check("Workforce real page tiene estado vacio", page.includes("Sin trabajadores todavia"), "empty");
check("Workforce real page crea trabajador", page.includes("handleCreate") && page.includes("createWorker"), "create");
check("Workforce real page crea acceso trabajador", page.includes("handleCreateUser") && page.includes("createWorkerUser"), "worker login");
check("Workforce real page muestra clave temporal una vez", page.includes("createdAccess") && page.includes("temporaryPassword"), "temporary password");
check("Workforce real page edita trabajador", page.includes("handleUpdate") && page.includes("updateWorker"), "update");
check("Workspace incluye trabajadores reales", workspace.includes("<WorkforceRealPage") && workspace.includes('label: "Trabajadores"'), "workspace");

check("Workforce local smoke crea dos tenants", localSmoke.includes("tenantA") && localSmoke.includes("tenantB"), "tenants");
check("Workforce local smoke valida aislamiento", localSmoke.includes("Tenant B no ve trabajador A"), "isolation");
check("Workforce local smoke limpia fixtures", localSmoke.includes("DELETE FROM workers") && localSmoke.includes("DELETE FROM tenants"), "cleanup");
check("Worker user smoke valida login real", workerUserSmoke.includes("/api/auth/login") && workerUserSmoke.includes("roles.includes(\"worker\")"), "worker login smoke");

check("Package script audit:workforce-real", Boolean(packageJson.scripts?.["audit:workforce-real"]), "audit");
check("Package script smoke:workforce-local", Boolean(packageJson.scripts?.["smoke:workforce-local"]), "smoke");
check("Package script smoke:worker-user-local", Boolean(packageJson.scripts?.["smoke:worker-user-local"]), "worker user smoke");
check("Verify incluye audit:workforce-real", String(packageJson.scripts?.verify).includes("audit:workforce-real"), "verify");

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Workforce real audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Workforce real audit passed with ${checks.length} checks.`);
