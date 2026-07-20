import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createRuntimeServer } from "../server/runtime/server.mjs";
import { createPostgresAttendanceRepositoryFromEnv } from "../server/runtime/postgresAttendanceRepository.mjs";

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

if (!adminDatabaseUrl || !runtimeDatabaseUrl) {
  console.log("Attendance local smoke skipped: ADMIN_DATABASE_URL and RUNTIME_DATABASE_URL are required.");
  process.exit(0);
}

const tenantA = randomUUID();
const tenantB = randomUUID();
const managerA = randomUUID();
const managerB = randomUUID();
const workerUserA = randomUUID();
const workerA = randomUUID();
const clientA = randomUUID();
const jobA = randomUUID();
const adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 2 });
const attendanceRepository = createPostgresAttendanceRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
let server;
let address;
let timeEntryId;

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
        ($1, 'Attendance Tenant A', 'construction', 'es-US', 'USD', 'America/Denver'),
        ($2, 'Attendance Tenant B', 'construction', 'es-US', 'USD', 'America/Denver')
    `,
    [tenantA, tenantB],
  );
  await withTenantAdmin(tenantA, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'manager-att-a@local.test', 'Manager A', 'active')", [managerA, tenantA]);
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'worker-att-a@local.test', 'Worker A', 'active')", [workerUserA, tenantA]);
    await client.query("INSERT INTO clients (client_id, tenant_id, name, status, primary_contact, email) VALUES ($1, $2, 'Cliente asistencia', 'active', 'Cliente A', 'cliente-att-a@local.test')", [clientA, tenantA]);
    await client.query(
      "INSERT INTO jobs (job_id, tenant_id, client_id, job_number, title, status, scheduled_start) VALUES ($1, $2, $3, 'JOB-ATT-001', 'Obra asistencia', 'in_progress', CURRENT_DATE)",
      [jobA, tenantA, clientA],
    );
    await client.query("INSERT INTO workers (worker_id, tenant_id, user_id, name, status, trade) VALUES ($1, $2, $3, 'Worker A', 'active', 'Installer')", [workerA, tenantA, workerUserA]);
  });
  await withTenantAdmin(tenantB, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'manager-att-b@local.test', 'Manager B', 'active')", [managerB, tenantB]);
  });
}

function contextForToken(token) {
  if (token === "tenant-b") {
    return {
      tenant: { tenantId: tenantB, companyName: "Attendance Tenant B" },
      actor: { userId: managerB, role: "manager", roles: ["manager"], capabilities: ["attendance.read", "attendance.review.visual"] },
    };
  }
  if (token === "worker-a") {
    return {
      tenant: { tenantId: tenantA, companyName: "Attendance Tenant A" },
      actor: { userId: workerUserA, role: "worker", roles: ["worker"], capabilities: ["attendance.self.visual"] },
    };
  }
  return {
    tenant: { tenantId: tenantA, companyName: "Attendance Tenant A" },
    actor: { userId: managerA, role: "manager", roles: ["manager"], capabilities: ["attendance.read", "attendance.review.visual"] },
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
    attendanceRepository,
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

  const clockIn = await request("worker-a", "/api/attendance/clock-in", {
    method: "POST",
    body: { jobId: jobA, location: { lat: 40.7608, lng: -111.891, accuracyM: 12 } },
  });
  timeEntryId = clockIn.body.entry?.timeEntryId;
  check("Worker A registra entrada", clockIn.status === 201 && Boolean(timeEntryId), JSON.stringify(clockIn.body));

  const breakStart = await request("worker-a", "/api/attendance/break-start", { method: "POST" });
  check("Worker A inicia descanso", breakStart.status === 200 && breakStart.body.entry?.status === "on_break", JSON.stringify(breakStart.body));

  const breakEnd = await request("worker-a", "/api/attendance/break-end", { method: "POST" });
  check("Worker A termina descanso", breakEnd.status === 200 && breakEnd.body.entry?.status === "active", JSON.stringify(breakEnd.body));

  const clockOut = await request("worker-a", "/api/attendance/clock-out", {
    method: "POST",
    body: { location: { lat: 40.7609, lng: -111.8911, accuracyM: 15 } },
  });
  check("Worker A registra salida", clockOut.status === 200 && clockOut.body.entry?.status === "submitted", JSON.stringify(clockOut.body));

  const listA = await request("manager-a", "/api/attendance/time-entries");
  check("Manager A ve jornada A", listA.status === 200 && listA.body.items.some((item) => item.timeEntryId === timeEntryId), JSON.stringify(listA.body));

  const listB = await request("tenant-b", "/api/attendance/time-entries");
  check("Tenant B no ve jornada A", listB.status === 200 && !listB.body.items.some((item) => item.timeEntryId === timeEntryId), JSON.stringify(listB.body));

  const approval = await request("manager-a", `/api/attendance/time-entries/${timeEntryId}/approve`, {
    method: "POST",
    body: { status: "approved" },
  });
  check("Manager A aprueba jornada", approval.status === 200 && approval.body.entry?.status === "approved", JSON.stringify(approval.body));

  const audit = await withTenantAdmin(tenantA, (client) =>
    client.query("SELECT count(*)::integer AS total FROM audit_events WHERE tenant_id = $1 AND module_id = 'attendance'", [tenantA]),
  );
  check("Asistencia genera auditoria", audit.rows[0].total >= 4, JSON.stringify(audit.rows[0]));
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await attendanceRepository?.close?.();
  for (const tenantId of [tenantA, tenantB]) {
    await withTenantAdmin(tenantId, async (client) => {
      await client.query("DELETE FROM notification_queue WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM attendance_approvals WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM break_entries WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM time_entries WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM workers WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM jobs WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM clients WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
    }).catch(() => {});
  }
  await adminPool.query("DELETE FROM tenants WHERE tenant_id = ANY($1::uuid[])", [[tenantA, tenantB]]).catch(() => {});
  await adminPool.end();
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Attendance local smoke failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Attendance local smoke passed with ${checks.length} checks.`);
