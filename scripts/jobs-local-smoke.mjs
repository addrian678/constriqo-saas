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
  console.log("Jobs local smoke skipped: ADMIN_DATABASE_URL and RUNTIME_DATABASE_URL are required.");
  process.exit(0);
}

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const clientA = randomUUID();
const clientB = randomUUID();
const estimateA = randomUUID();
const adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 2 });
const jobRepository = createPostgresJobRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
let server;
let address;
let jobAId;

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
        ($1, 'Jobs Smoke Tenant A', 'construction', 'es-US', 'USD', 'America/Denver'),
        ($2, 'Jobs Smoke Tenant B', 'construction', 'es-US', 'USD', 'America/Denver')
    `,
    [tenantA, tenantB],
  );
  await withTenantAdmin(tenantA, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'jobs-a@local.test', 'Jobs A', 'active')", [userA, tenantA]);
    await client.query("INSERT INTO clients (client_id, tenant_id, name, status, email) VALUES ($1, $2, 'Cliente jobs A', 'active', 'a@example.com')", [clientA, tenantA]);
    await client.query("INSERT INTO estimates (estimate_id, tenant_id, client_id, estimate_number, status, total_amount, currency) VALUES ($1, $2, $3, 'EST-JOBS-A', 'approved', 1000, 'USD')", [estimateA, tenantA, clientA]);
  });
  await withTenantAdmin(tenantB, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'jobs-b@local.test', 'Jobs B', 'active')", [userB, tenantB]);
    await client.query("INSERT INTO clients (client_id, tenant_id, name, status, email) VALUES ($1, $2, 'Cliente jobs B', 'active', 'b@example.com')", [clientB, tenantB]);
  });
}

function contextForToken(token) {
  const isB = token === "tenant-b";
  return {
    tenant: { tenantId: isB ? tenantB : tenantA, companyName: isB ? "Jobs Smoke Tenant B" : "Jobs Smoke Tenant A" },
    actor: {
      userId: isB ? userB : userA,
      role: "admin",
      roles: ["admin"],
      capabilities: ["jobs.read", "jobs.create", "jobs.update"],
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

  const create = await request("tenant-a", "/api/jobs", {
    method: "POST",
    body: {
      clientId: clientA,
      estimateId: estimateA,
      title: "Obra temporal smoke",
      scheduledStart: "2026-08-01",
      scheduledEnd: "2026-08-15",
      phases: ["Preparacion", "Instalacion", "Entrega"],
    },
  });
  jobAId = create.body.job?.jobId;
  check("Tenant A crea obra", create.status === 201 && Boolean(jobAId), JSON.stringify(create.body));

  const listA = await request("tenant-a", "/api/jobs");
  check("Tenant A ve su obra", listA.status === 200 && listA.body.items.some((item) => item.jobId === jobAId), JSON.stringify(listA.body));

  const listB = await request("tenant-b", "/api/jobs");
  check("Tenant B no ve obra A", listB.status === 200 && !listB.body.items.some((item) => item.jobId === jobAId), JSON.stringify(listB.body));

  const detailB = await request("tenant-b", `/api/jobs/${jobAId}`);
  check("Tenant B no lee detalle A", detailB.status === 404, JSON.stringify(detailB.body));

  const detailA = await request("tenant-a", `/api/jobs/${jobAId}`);
  check("Tenant A lee detalle con fases", detailA.status === 200 && detailA.body.phases?.length === 3, JSON.stringify(detailA.body));

  const task = await request("tenant-a", `/api/jobs/${jobAId}/tasks`, {
    method: "POST",
    body: { title: "Instalar porcelanato" },
  });
  check("Tenant A crea tarea", task.status === 201 && task.body.task?.title === "Instalar porcelanato", JSON.stringify(task.body));

  const change = await request("tenant-a", `/api/jobs/${jobAId}/change-requests`, {
    method: "POST",
    body: { title: "Cambio de material", amountDelta: 250 },
  });
  check("Tenant A crea cambio", change.status === 201 && change.body.changeRequest?.amountDelta === 250, JSON.stringify(change.body));

  const auditCount = await withTenantAdmin(tenantA, (client) =>
    client.query("SELECT count(*)::integer AS total FROM audit_events WHERE tenant_id = $1 AND module_id = 'jobs'", [tenantA]),
  );
  check("Operaciones jobs generan auditoria", auditCount.rows[0].total >= 3, JSON.stringify(auditCount.rows[0]));
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await jobRepository?.close?.();
  for (const tenantId of [tenantA, tenantB]) {
    await withTenantAdmin(tenantId, async (client) => {
      await client.query("DELETE FROM job_change_requests WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM job_tasks WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM job_phases WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM jobs WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM estimate_versions WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM estimates WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM clients WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
    }).catch(() => {});
  }
  await adminPool.query("DELETE FROM tenants WHERE tenant_id = ANY($1::uuid[])", [[tenantA, tenantB]]).catch(() => {});
  await adminPool.end();
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Jobs local smoke failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Jobs local smoke passed with ${checks.length} checks.`);
