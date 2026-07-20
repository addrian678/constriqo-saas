import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createRuntimeServer } from "../server/runtime/server.mjs";
import { createPostgresNotificationsRepositoryFromEnv } from "../server/runtime/postgresNotificationsRepository.mjs";

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

if (!adminDatabaseUrl || !runtimeDatabaseUrl) {
  console.log("Notifications local smoke skipped: ADMIN_DATABASE_URL and RUNTIME_DATABASE_URL are required.");
  process.exit(0);
}

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userAHidden = randomUUID();
const userB = randomUUID();
const notificationA = randomUUID();
const notificationA2 = randomUUID();
const notificationHidden = randomUUID();
const auditA = randomUUID();
const adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 2 });
const notificationsRepository = createPostgresNotificationsRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
let server;
let address;

async function withTenantAdmin(tenantId, callback) {
  const client = await adminPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function setupFixtures() {
  await adminPool.query(
    `
      INSERT INTO tenants (tenant_id, name, industry_profile, locale, currency, timezone)
      VALUES
        ($1, 'Notifications Tenant A', 'construction', 'es-US', 'USD', 'America/Denver'),
        ($2, 'Notifications Tenant B', 'construction', 'es-US', 'USD', 'America/Denver')
    `,
    [tenantA, tenantB],
  );
  await withTenantAdmin(tenantA, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'notify-a@local.test', 'Notify A', 'active')", [userA, tenantA]);
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'notify-a-hidden@local.test', 'Notify A Hidden', 'active')", [userAHidden, tenantA]);
    await client.query(
      `
        INSERT INTO notification_queue (notification_queue_id, tenant_id, audience_role, channel, event_key, title, message, severity, related_entity_type, related_entity_id)
        VALUES ($1, $2, 'admin', 'in_app', 'attendance.clock_in', 'Entrada registrada', 'Trabajador inicio jornada.', 'info', 'time_entry', $3)
      `,
      [notificationA, tenantA, randomUUID()],
    );
    await client.query(
      `
        INSERT INTO notification_queue (notification_queue_id, tenant_id, audience_role, channel, event_key, title, message, severity, related_entity_type, related_entity_id)
        VALUES ($1, $2, 'admin', 'in_app', 'worker.task.completed', 'Tarea completada', 'Trabajador completo checklist.', 'success', 'job_task', $3)
      `,
      [notificationA2, tenantA, randomUUID()],
    );
    await client.query(
      `
        INSERT INTO notification_queue (notification_queue_id, tenant_id, recipient_user_id, audience_role, channel, event_key, title, message, severity, related_entity_type, related_entity_id)
        VALUES ($1, $2, $3, 'worker', 'in_app', 'jobs.task.assigned', 'Privada', 'Solo otro usuario debe verla.', 'info', 'job_task', $4)
      `,
      [notificationHidden, tenantA, userAHidden, randomUUID()],
    );
    await client.query(
      `
        INSERT INTO audit_events (audit_event_id, tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
        VALUES ($1, $2, $3, 'smoke.audit.created', 'smoke', 'notification', $4, 'info', '{}'::jsonb)
      `,
      [auditA, tenantA, userA, notificationA],
    );
  });
  await withTenantAdmin(tenantB, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'notify-b@local.test', 'Notify B', 'active')", [userB, tenantB]);
  });
}

function contextForToken(token) {
  const isB = token === "tenant-b";
  return {
    tenant: { tenantId: isB ? tenantB : tenantA, companyName: isB ? "Notifications Tenant B" : "Notifications Tenant A" },
    actor: {
      userId: isB ? userB : userA,
      role: "admin",
      roles: ["admin"],
      capabilities: ["notifications.read", "audit.read"],
    },
  };
}

async function request(token, path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return {
    status: response.status,
    body: await response.json(),
  };
}

try {
  await setupFixtures();
  server = createRuntimeServer({
    notificationsRepository,
    sessionContextResolver: {
      async resolve(input) {
        const token = String(input.authorizationHeader || "").replace(/^Bearer\s+/u, "");
        return contextForToken(token);
      },
    },
  });
  address = await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address()));
  });

  const notificationsA = await request("tenant-a", "/api/notifications");
  check("Tenant A ve notificacion", notificationsA.status === 200 && notificationsA.body.items.some((item) => item.notificationId === notificationA), JSON.stringify(notificationsA.body));
  check("Usuario A no ve notificacion de otro usuario", notificationsA.status === 200 && !notificationsA.body.items.some((item) => item.notificationId === notificationHidden), JSON.stringify(notificationsA.body));

  const notificationsB = await request("tenant-b", "/api/notifications");
  check("Tenant B no ve notificacion A", notificationsB.status === 200 && !notificationsB.body.items.some((item) => item.notificationId === notificationA), JSON.stringify(notificationsB.body));

  const auditEventsA = await request("tenant-a", "/api/audit-events");
  check("Tenant A ve auditoria", auditEventsA.status === 200 && auditEventsA.body.items.some((item) => item.auditEventId === auditA), JSON.stringify(auditEventsA.body));

  const auditEventsB = await request("tenant-b", "/api/audit-events");
  check("Tenant B no ve auditoria A", auditEventsB.status === 200 && !auditEventsB.body.items.some((item) => item.auditEventId === auditA), JSON.stringify(auditEventsB.body));

  const read = await request("tenant-a", `/api/notifications/${notificationA}/read`, { method: "PATCH" });
  check("Tenant A marca notificacion vista", read.status === 200 && read.body.notification?.status === "read", JSON.stringify(read.body));

  const bulkRead = await request("tenant-a", "/api/notifications/read-visible", {
    method: "POST",
    body: { role: "admin", status: "pending" },
  });
  check("Tenant A marca visibles como vista", bulkRead.status === 200 && bulkRead.body.updated === 1, JSON.stringify(bulkRead.body));

  const preferences = await request("tenant-a", "/api/notifications/preferences");
  check("Tenant A lista preferencias", preferences.status === 200 && preferences.body.items?.some((item) => item.eventKey === "attendance.clock_in"), JSON.stringify(preferences.body));

  const preferenceUpdate = await request("tenant-a", "/api/notifications/preferences", {
    method: "PATCH",
    body: { eventKey: "attendance.clock_in", channel: "push_future", enabled: false },
  });
  check("Tenant A actualiza preferencia", preferenceUpdate.status === 200 && preferenceUpdate.body.preference?.enabled === false, JSON.stringify(preferenceUpdate.body));

  const notificationsAfterPreference = await request("tenant-a", "/api/notifications");
  check(
    "Preferencia desactivada oculta evento al usuario",
    notificationsAfterPreference.status === 200 && !notificationsAfterPreference.body.items.some((item) => item.notificationId === notificationA),
    JSON.stringify(notificationsAfterPreference.body),
  );
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await notificationsRepository?.close?.();
  for (const tenantId of [tenantA, tenantB]) {
    await withTenantAdmin(tenantId, async (client) => {
      await client.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM notification_preferences WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM notification_queue WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
    }).catch(() => {});
  }
  await adminPool.query("DELETE FROM tenants WHERE tenant_id = ANY($1::uuid[])", [[tenantA, tenantB]]).catch(() => {});
  await adminPool.end();
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Notifications local smoke failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Notifications local smoke passed with ${checks.length} checks.`);
