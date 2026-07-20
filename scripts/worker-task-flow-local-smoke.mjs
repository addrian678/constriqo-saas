import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createRuntimeServer } from "../server/runtime/server.mjs";
import { createPostgresJobRepositoryFromEnv } from "../server/runtime/postgresJobRepository.mjs";

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

if (!adminDatabaseUrl || !runtimeDatabaseUrl) {
  console.log("Worker task flow smoke skipped: ADMIN_DATABASE_URL and RUNTIME_DATABASE_URL are required.");
  process.exit(0);
}

const tenantA = randomUUID();
const tenantB = randomUUID();
const adminA = randomUUID();
const workerUserA = randomUUID();
const workerUserB = randomUUID();
const workerA = randomUUID();
const workerB = randomUUID();
const clientA = randomUUID();
const adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 2 });
const jobRepository = createPostgresJobRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
let server;
let address;
let jobAId;
let taskAId;

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
        ($1, 'Worker Task Tenant A', 'construction', 'es-US', 'USD', 'America/Denver'),
        ($2, 'Worker Task Tenant B', 'construction', 'es-US', 'USD', 'America/Denver')
    `,
    [tenantA, tenantB],
  );
  await withTenantAdmin(tenantA, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'admin-worker-a@local.test', 'Admin A', 'active')", [adminA, tenantA]);
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'worker-a@local.test', 'Worker A', 'active')", [workerUserA, tenantA]);
    await client.query("INSERT INTO workers (worker_id, tenant_id, user_id, name, status, trade) VALUES ($1, $2, $3, 'Worker A', 'active', 'Installer')", [workerA, tenantA, workerUserA]);
    await client.query("INSERT INTO clients (client_id, tenant_id, name, status, email) VALUES ($1, $2, 'Cliente task A', 'active', 'task-a@example.com')", [clientA, tenantA]);
  });
  await withTenantAdmin(tenantB, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'worker-b@local.test', 'Worker B', 'active')", [workerUserB, tenantB]);
    await client.query("INSERT INTO workers (worker_id, tenant_id, user_id, name, status, trade) VALUES ($1, $2, $3, 'Worker B', 'active', 'Cleaner')", [workerB, tenantB, workerUserB]);
  });
}

function contextForToken(token) {
  if (token === "worker-b") {
    return {
      tenant: { tenantId: tenantB, companyName: "Worker Task Tenant B" },
      actor: {
        userId: workerUserB,
        role: "worker",
        roles: ["worker"],
        capabilities: ["worker.tasks.read", "worker.tasks.update"],
      },
    };
  }

  if (token === "worker-a") {
    return {
      tenant: { tenantId: tenantA, companyName: "Worker Task Tenant A" },
      actor: {
        userId: workerUserA,
        role: "worker",
        roles: ["worker"],
        capabilities: ["worker.tasks.read", "worker.tasks.update"],
      },
    };
  }

  return {
    tenant: { tenantId: tenantA, companyName: "Worker Task Tenant A" },
    actor: {
      userId: adminA,
      role: "admin",
      roles: ["admin"],
      capabilities: ["jobs.read", "jobs.create", "jobs.update", "workforce.read"],
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
    jobRepository,
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

  const create = await request("admin-a", "/api/jobs", {
    method: "POST",
    body: {
      clientId: clientA,
      title: "Obra con checklist trabajador",
      phases: ["Preparacion", "Instalacion", "Entrega"],
    },
  });
  jobAId = create.body.job?.jobId;
  check("Admin crea obra para checklist", create.status === 201 && Boolean(jobAId), JSON.stringify(create.body));

  const detailA = await request("admin-a", `/api/jobs/${jobAId}`);
  const phaseId = detailA.body.phases?.[0]?.phaseId;
  check("Admin lee fases de la obra", detailA.status === 200 && Boolean(phaseId), JSON.stringify(detailA.body));

  const task = await request("admin-a", `/api/jobs/${jobAId}/tasks`, {
    method: "POST",
    body: { title: "Completar checklist de instalacion", jobPhaseId: phaseId, assignedToWorkerId: workerA },
  });
  taskAId = task.body.task?.taskId;
  check("Admin crea tarea asignada a Worker A", task.status === 201 && task.body.task?.assignedToWorkerId === workerA, JSON.stringify(task.body));

  const workerTasksA = await request("worker-a", "/api/worker/tasks");
  check("Worker A ve su tarea asignada", workerTasksA.status === 200 && workerTasksA.body.items.some((item) => item.taskId === taskAId), JSON.stringify(workerTasksA.body));

  const workerTasksB = await request("worker-b", "/api/worker/tasks");
  check("Worker B no ve tareas de A", workerTasksB.status === 200 && !workerTasksB.body.items.some((item) => item.taskId === taskAId), JSON.stringify(workerTasksB.body));

  const forbiddenUpdate = await request("worker-b", `/api/worker/tasks/${taskAId}`, {
    method: "PATCH",
    body: { status: "completed" },
  });
  check("Worker B no actualiza tarea de A", forbiddenUpdate.status === 403, JSON.stringify(forbiddenUpdate.body));

  const complete = await request("worker-a", `/api/worker/tasks/${taskAId}`, {
    method: "PATCH",
    body: { status: "completed" },
  });
  check("Worker A completa su tarea", complete.status === 200 && complete.body.task?.status === "completed", JSON.stringify(complete.body));

  const detailAfter = await request("admin-a", `/api/jobs/${jobAId}`);
  check(
    "Admin ve progreso completado",
    detailAfter.status === 200 && detailAfter.body.job?.progressPercent === 100 && detailAfter.body.job?.completedTasks === 1,
    JSON.stringify(detailAfter.body.job),
  );
  check(
    "Fases avanzan segun checklist",
    detailAfter.body.phases?.[0]?.status === "completed" && detailAfter.body.phases?.[1]?.status === "active",
    JSON.stringify(detailAfter.body.phases),
  );

  const auditCount = await withTenantAdmin(tenantA, (client) =>
    client.query("SELECT count(*)::integer AS total FROM audit_events WHERE tenant_id = $1 AND action IN ('jobs.task.created', 'worker.task.completed')", [tenantA]),
  );
  check("Checklist genera auditoria", auditCount.rows[0].total >= 2, JSON.stringify(auditCount.rows[0]));
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await jobRepository?.close?.();
  for (const tenantId of [tenantA, tenantB]) {
    await withTenantAdmin(tenantId, async (client) => {
      await client.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM assignments WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM job_change_requests WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM job_tasks WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM job_phases WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM jobs WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM clients WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM workers WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
    }).catch(() => {});
  }
  await adminPool.query("DELETE FROM tenants WHERE tenant_id = ANY($1::uuid[])", [[tenantA, tenantB]]).catch(() => {});
  await adminPool.end();
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Worker task flow smoke failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Worker task flow smoke passed with ${checks.length} checks.`);
