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

const migration = readProjectFile("database/migrations/0025_attendance_runtime_and_user_roles.sql");
const repository = readProjectFile("server/runtime/postgresAttendanceRepository.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const routes = readProjectFile("server/runtime/runtimeRoutes.mjs");
const apiClient = readProjectFile("src/modules/attendance/api/attendanceClient.ts");
const adminPage = readProjectFile("src/modules/attendance/pages/AttendanceRealPage.tsx");
const workerWorkspace = readProjectFile("src/app/WorkerProductionWorkspace.tsx");
const nativeCapabilities = readProjectFile("src/app/native/nativeCapabilities.ts");
const productionWorkspace = readProjectFile("src/app/ProductionWorkspace.tsx");
const localSmoke = readProjectFile("scripts/attendance-local-smoke.mjs");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("Migration agrega ubicacion puntual", migration.includes("clock_in_lat") && migration.includes("clock_out_lat"), "location columns");
check("Migration agrega capacidades asistencia", migration.includes("attendance.self.visual") && migration.includes("attendance.review.visual"), "capabilities");
check("Migration define matriz manager/worker", migration.includes("r.code = 'manager'") && migration.includes("r.code = 'worker'"), "role grants");

check("Attendance repository activa tenant context", repository.includes("set_config('app.tenant_id'"), "tenant context");
check("Attendance repository resuelve worker por actor", repository.includes("resolveWorkerForActor") && repository.includes("context.actor.userId"), "worker actor");
check("Attendance repository bloquea jornada doble", repository.includes("Ya tienes una jornada abierta"), "single open entry");
check("Attendance repository maneja descanso", repository.includes("startBreak") && repository.includes("endBreak"), "breaks");
check("Attendance repository escribe auditoria", repository.includes("INSERT INTO audit_events") && repository.includes("attendance.clock_in"), "audit");
check("Attendance repository crea notificacion", repository.includes("notification_queue") && repository.includes("Entrada registrada"), "notifications");
check("Attendance repository no toma tenant desde input", !repository.includes("input.tenantId") && !repository.includes("body.tenantId"), "no tenant input");

check("Runtime importa attendance repository con pool compartido", server.includes("createPostgresAttendanceRepository(sharedPool)"), "shared pool import");
check("Runtime conecta handler attendance", server.includes("handleAttendanceRoute") && server.includes('route.moduleId === "attendance"'), "handler");
check("Runtime devuelve 503 si no conectado", server.includes("ATTENDANCE_REPOSITORY_NOT_CONFIGURED"), "503");

check("Rutas attendance incluyen my day", routes.includes("/api/attendance/me"), "me route");
check("Rutas attendance incluyen clock in/out", routes.includes("/api/attendance/clock-in") && routes.includes("/api/attendance/clock-out"), "clock routes");
check("Rutas attendance incluyen descansos", routes.includes("/api/attendance/break-start") && routes.includes("/api/attendance/break-end"), "break routes");
check("Rutas attendance separan review", routes.includes("attendance.review.visual") && routes.includes("/api/attendance/time-entries/:timeEntryId/approve"), "review route");

check("Attendance API cubre worker y admin", apiClient.includes("getMyAttendance") && apiClient.includes("listTimeEntries"), "api read");
check("Attendance API cubre acciones", apiClient.includes("clockIn") && apiClient.includes("clockOut") && apiClient.includes("startBreak"), "api actions");

check("Admin attendance page no usa mock data", !adminPage.includes("mock-data") && adminPage.includes("listTimeEntries"), "admin real");
check("Production workspace incluye asistencia", productionWorkspace.includes("<AttendanceRealPage") && productionWorkspace.includes('label: "Asistencia"'), "workspace");
check("Worker workspace usa asistencia real", workerWorkspace.includes("getMyAttendance") && workerWorkspace.includes("Registrar entrada"), "worker real");
check("Worker workspace usa puente nativo de ubicacion", workerWorkspace.includes("capturePointInTimeLocation"), "native bridge");
check("Puente nativo captura geolocalizacion puntual", nativeCapabilities.includes("navigator.geolocation") && nativeCapabilities.includes("enableHighAccuracy"), "location");

check("Attendance smoke valida clock flow", localSmoke.includes("clock-in") && localSmoke.includes("break-start") && localSmoke.includes("clock-out"), "flow");
check("Attendance smoke valida aislamiento", localSmoke.includes("Tenant B no ve jornada A"), "isolation");
check("Package script audit:attendance-real", Boolean(packageJson.scripts?.["audit:attendance-real"]), "audit script");
check("Package script smoke:attendance-local", Boolean(packageJson.scripts?.["smoke:attendance-local"]), "smoke script");
check("Verify incluye audit:attendance-real", String(packageJson.scripts?.verify).includes("audit:attendance-real"), "verify");

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Attendance real audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Attendance real audit passed with ${checks.length} checks.`);
