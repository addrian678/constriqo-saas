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

const repository = readProjectFile("server/runtime/postgresJobRepository.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const routes = readProjectFile("server/runtime/runtimeRoutes.mjs");
const apiClient = readProjectFile("src/modules/jobs/api/jobClient.ts");
const page = readProjectFile("src/modules/jobs/pages/JobsRealPage.tsx");
const workspace = readProjectFile("src/app/ProductionWorkspace.tsx");
const productionApp = readProjectFile("src/app/ProductionApp.tsx");
const workerWorkspace = readProjectFile("src/app/WorkerProductionWorkspace.tsx");
const localSmoke = readProjectFile("scripts/jobs-local-smoke.mjs");
const workerSmoke = readProjectFile("scripts/worker-task-flow-local-smoke.mjs");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("Jobs repository activa tenant context", repository.includes("set_config('app.tenant_id'"), "app.tenant_id");
check("Jobs repository escribe auditoria", repository.includes("INSERT INTO audit_events") && repository.includes("jobs.created"), "audit_events");
check("Jobs repository valida cliente tenant", repository.includes("requireClientForTenant"), "requireClientForTenant");
check("Jobs repository valida cotizacion tenant", repository.includes("requireEstimateForTenant"), "requireEstimateForTenant");
check("Jobs repository no toma tenant desde input", !repository.includes("input.tenantId") && !repository.includes("body.tenantId"), "no input tenant");
check("Jobs repository crea fases por defecto", repository.includes("insertDefaultPhases") && repository.includes("Preparacion"), "default phases");
check("Jobs repository registra cambios", repository.includes("createChangeRequest") && repository.includes("change_pending"), "change requests");
check("Jobs repository calcula progreso", repository.includes("progress_percent") && repository.includes("completed_tasks"), "progress");
check("Jobs repository valida GPS de obra", repository.includes("validateCoordinatePair") && repository.includes("allowedRadiusMeters: clampNumber(input?.allowedRadiusMeters, 25, 5000, 250)"), "job geofence validation");
check("Jobs repository sincroniza fases desde checklist", repository.includes("syncJobPhasesFromTasks") && repository.includes("allPhasesCompleted"), "phase sync");
check("Jobs repository asigna tareas a workers", repository.includes("assigned_to_worker_id") && repository.includes("ensureAssignmentForWorker"), "task assignment");
check("Jobs repository filtra tareas por actor worker", repository.includes("resolveWorkerForActor") && repository.includes("assigned_to_worker_id = $2"), "worker self filter");

check("Runtime importa job repository con pool compartido", server.includes("createPostgresJobRepository(sharedPool)"), "shared pool import");
check("Runtime conecta handler jobs", server.includes("handleJobRoute") && server.includes('route.moduleId === "jobs"'), "handler");
check("Runtime conecta handler trabajador", server.includes("handleWorkerSelfRoute") && server.includes('route.moduleId === "worker-self"'), "worker handler");
check("Runtime devuelve 503 si jobs no conectado", server.includes("JOB_REPOSITORY_NOT_CONFIGURED"), "503");

check("Rutas jobs incluyen lista y detalle", routes.includes('/api/jobs"') && routes.includes("/api/jobs/:jobId"), "routes");
check("Rutas jobs incluyen tareas", routes.includes("/api/jobs/:jobId/tasks"), "tasks");
check("Rutas jobs permiten actualizar tareas", routes.includes("/api/jobs/:jobId/tasks/:taskId"), "task update");
check("Rutas jobs incluyen cambios", routes.includes("/api/jobs/:jobId/change-requests"), "changes");
check("Rutas worker-self son separadas", routes.includes("/api/worker/tasks") && routes.includes("worker.tasks.update"), "worker routes");

check("Jobs API no envia tenantId", !apiClient.includes("tenantId"), "tenant from session");
check("Jobs API cubre crear/listar/detalle", apiClient.includes("createJob") && apiClient.includes("listJobs") && apiClient.includes("getJob"), "api");
check("Jobs API cubre tareas/cambios", apiClient.includes("createJobTask") && apiClient.includes("createJobChangeRequest"), "api actions");
check("Jobs API cubre checklist trabajador", apiClient.includes("listWorkerTasks") && apiClient.includes("updateWorkerTask"), "worker api");

check("Jobs real page no importa mock data", !page.includes("mock-data") && !page.includes("jobsData"), "no mock");
check("Jobs real page usa clientes reales", page.includes("listCrmClients"), "clients");
check("Jobs real page usa cotizaciones reales", page.includes("listEstimates"), "estimates");
check("Jobs real page usa trabajadores reales", page.includes("listWorkers") && page.includes("assignedToWorkerId"), "workers");
check("Jobs real page tiene estado vacio", page.includes("Sin obras todavia"), "empty state");
check("Jobs real page crea obra", page.includes("handleCreateJob") && page.includes("createJob"), "create");
check("Jobs real page permite GPS en crear y editar", page.includes("Usar mi ubicacion") && page.includes("projectLatitude") && page.includes("projectLongitude"), "job geofence ui");
check("Jobs real page crea y actualiza tareas", page.includes("handleCreateTask") && page.includes("handleTaskUpdate"), "task update");
check("Jobs real page muestra progreso", page.includes("progress-track") && page.includes("progressPercent"), "progress ui");
check("Workspace incluye obras reales", workspace.includes("<JobsRealPage") && workspace.includes('label: "Obras"'), "workspace");
check("Production app separa trabajador puro", productionApp.includes("WorkerProductionWorkspace") && productionApp.includes("isWorkerOnly"), "worker role split");
check("Worker workspace no expone modulos admin", workerWorkspace.includes("Mis tareas") && !workerWorkspace.includes("<CrmRealPage"), "worker workspace");
check("Worker workspace marca checklist", workerWorkspace.includes("updateWorkerTask") && workerWorkspace.includes("Completar"), "worker checklist");

check("Jobs local smoke crea dos tenants", localSmoke.includes("tenantA") && localSmoke.includes("tenantB"), "tenants");
check("Jobs local smoke valida aislamiento", localSmoke.includes("Tenant B no ve obra A"), "isolation");
check("Jobs local smoke limpia fixtures", localSmoke.includes("DELETE FROM jobs") && localSmoke.includes("DELETE FROM tenants"), "cleanup");
check("Worker task smoke valida aislamiento", workerSmoke.includes("Worker B no ve tareas de A") && workerSmoke.includes("Worker B no actualiza tarea de A"), "worker isolation");
check("Worker task smoke valida avance de fases", workerSmoke.includes("Fases avanzan segun checklist"), "phase progression");

check("Package script audit:jobs-real", Boolean(packageJson.scripts?.["audit:jobs-real"]), "audit");
check("Package script smoke:jobs-local", Boolean(packageJson.scripts?.["smoke:jobs-local"]), "smoke");
check("Package script smoke:worker-task-flow-local", Boolean(packageJson.scripts?.["smoke:worker-task-flow-local"]), "worker smoke");
check("Verify incluye audit:jobs-real", String(packageJson.scripts?.verify).includes("audit:jobs-real"), "verify");

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Jobs real audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Jobs real audit passed with ${checks.length} checks.`);
