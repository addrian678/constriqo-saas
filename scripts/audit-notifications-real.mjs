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

const migration = readProjectFile("database/migrations/0032_notifications_audit_runtime.sql");
const recipientMigration = readProjectFile("database/migrations/0037_notification_recipient_user.sql");
const preferencesMigration = readProjectFile("database/migrations/0038_notification_preferences.sql");
const eventKeyMigration = readProjectFile("database/migrations/0044_notification_event_keys.sql");
const repository = readProjectFile("server/runtime/postgresNotificationsRepository.mjs");
const jobRepository = readProjectFile("server/runtime/postgresJobRepository.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const routes = readProjectFile("server/runtime/runtimeRoutes.mjs");
const manifest = readProjectFile("server/runtime/runtimeManifest.mjs");
const apiClient = readProjectFile("src/modules/notifications/api/notificationsClient.ts");
const page = readProjectFile("src/modules/notifications/pages/NotificationsAuditRealPage.tsx");
const workspace = readProjectFile("src/app/ProductionWorkspace.tsx");
const workerWorkspace = readProjectFile("src/app/WorkerProductionWorkspace.tsx");
const localSmoke = readProjectFile("scripts/notifications-local-smoke.mjs");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("Migration registra permisos reales", migration.includes("notifications.read") && migration.includes("audit.read"), "capabilities");
check("Migration otorga permisos por rol", migration.includes("r.code = 'admin'") && migration.includes("r.code = 'worker'"), "role grants");
check("Migration agrega destinatario por usuario", recipientMigration.includes("recipient_user_id") && recipientMigration.includes("idx_notification_queue_tenant_recipient_created"), "recipient user");
check("Migration agrega preferencias por usuario", preferencesMigration.includes("notification_preferences") && preferencesMigration.includes("push_future") && preferencesMigration.includes("PRIMARY KEY"), "preferences");
check("Migration agrega claves de evento", eventKeyMigration.includes("event_key") && eventKeyMigration.includes("idx_notification_queue_tenant_event_key"), "event key");

check("Repository activa tenant context", repository.includes("set_config('app.tenant_id'"), "tenant context");
check("Repository lee notification_queue", repository.includes("notification_queue") && repository.includes("listNotifications"), "notifications");
check("Repository filtra destinatario visible", repository.includes("recipient_user_id IS NULL OR") && repository.includes("summarizeVisibleNotifications"), "recipient filter");
check("Repository lee audit_events", repository.includes("audit_events") && repository.includes("listAuditEvents"), "audit");
check("Repository marca notificacion vista", repository.includes("markNotificationRead") && repository.includes("status = 'read'"), "read");
check("Repository marca notificaciones visibles", repository.includes("markNotificationsRead") && repository.includes("notifications.bulk_read"), "bulk read");
check("Repository gestiona preferencias", repository.includes("listNotificationPreferences") && repository.includes("updateNotificationPreference") && repository.includes("notifications.preference.updated"), "preferences");
check("Repository aplica preferencias al listar", repository.includes("COALESCE(np.enabled, true) = true") && repository.includes("event_key"), "preference filter");
check("Repository no toma tenant desde input", !repository.includes("input.tenantId") && !repository.includes("body.tenantId"), "no tenant input");
check("Checklist trabajador genera notificacion", jobRepository.includes("enqueueJobNotification") && jobRepository.includes("worker.task.completed"), "worker task notification");
check("Asignacion de tarea notifica trabajador especifico", jobRepository.includes("enqueueTaskAssignmentNotification") && jobRepository.includes("recipient_user_id") && jobRepository.includes("Nueva tarea asignada"), "worker recipient notification");

check("Runtime importa repository con pool compartido", server.includes("createPostgresNotificationsRepository(sharedPool)"), "shared pool import");
check("Runtime conecta modulo", server.includes("handleNotificationsRoute") && server.includes('route.moduleId === "notifications-audit-reports"'), "handler");
check("Runtime devuelve 503 si falta repository", server.includes("NOTIFICATIONS_REPOSITORY_NOT_CONFIGURED"), "503");

check("Rutas notificaciones reales", routes.includes("/api/notifications") && routes.includes("/api/notifications/:notificationId/read") && routes.includes("/api/notifications/read-visible") && routes.includes("/api/notifications/preferences"), "notifications routes");
check("Ruta auditoria real", routes.includes("/api/audit-events") && routes.includes('capability: "audit.read"'), "audit route");
check("Manifest incluye rutas", manifest.includes("/api/notifications") && manifest.includes("/api/notifications/read-visible") && manifest.includes("/api/notifications/preferences") && manifest.includes("/api/audit-events"), "manifest");

check("API cubre list/read/audit", apiClient.includes("listRuntimeNotifications") && apiClient.includes("markRuntimeNotificationRead") && apiClient.includes("markVisibleNotificationsRead") && apiClient.includes("listNotificationPreferences") && apiClient.includes("updateNotificationPreference") && apiClient.includes("listAuditEvents"), "api");
check("API expone eventKey", apiClient.includes("eventKey: string"), "eventKey type");
check("Pagina no usa mock data", !page.includes("mock-data") && !page.includes("visualNotifications"), "no mock");
check("Pagina muestra notificaciones y auditoria", page.includes("activeView") && page.includes("filteredAuditEvents"), "ui");
check("Pagina filtra y marca visibles", page.includes("roleFilter") && page.includes("statusFilter") && page.includes("handleMarkVisibleRead"), "filters bulk");
check("Pagina muestra preferencias", page.includes('"preferences"') && page.includes("handlePreferenceToggle") && page.includes("channelLabel"), "preferences ui");
check("Workspace expone alertas reales", workspace.includes("<NotificationsAuditRealPage") && workspace.includes('label: "Alertas"'), "workspace");
check("Worker workspace tiene bandeja propia", workerWorkspace.includes("Mis alertas") && workerWorkspace.includes("listRuntimeNotifications") && workerWorkspace.includes('role: "worker"'), "worker notifications");
check("Worker workspace no expone auditoria admin", !workerWorkspace.includes("NotificationsAuditRealPage") && !workerWorkspace.includes("audit-events") && !workerWorkspace.includes("listAuditEvents"), "worker isolation");

check("Smoke valida aislamiento", localSmoke.includes("Tenant B no ve notificacion A") && localSmoke.includes("Tenant B no ve auditoria A"), "isolation smoke");
check("Smoke valida marcar vista", localSmoke.includes("Tenant A marca notificacion vista"), "read smoke");
check("Smoke valida bulk vista", localSmoke.includes("Tenant A marca visibles como vista"), "bulk smoke");
check("Smoke valida preferencias aplicadas", localSmoke.includes("Preferencia desactivada oculta evento al usuario"), "preference filter smoke");
check("Package script audit:notifications-real", Boolean(packageJson.scripts?.["audit:notifications-real"]), "audit script");
check("Package script smoke:notifications-local", Boolean(packageJson.scripts?.["smoke:notifications-local"]), "smoke script");

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Notifications real audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Notifications real audit passed with ${checks.length} checks.`);
