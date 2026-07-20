import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createRuntimeServer } from "../server/runtime/server.mjs";
import { createPostgresWorkforceRepositoryFromEnv } from "../server/runtime/postgresWorkforceRepository.mjs";

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

if (!adminDatabaseUrl || !runtimeDatabaseUrl) {
  console.log("Workforce local smoke skipped: ADMIN_DATABASE_URL and RUNTIME_DATABASE_URL are required.");
  process.exit(0);
}

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 2 });
const workforceRepository = createPostgresWorkforceRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
let server;
let address;
let workerAId;

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
        ($1, 'Workforce Smoke Tenant A', 'construction', 'es-US', 'USD', 'America/Denver'),
        ($2, 'Workforce Smoke Tenant B', 'construction', 'es-US', 'USD', 'America/Denver')
    `,
    [tenantA, tenantB],
  );
  await withTenantAdmin(tenantA, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'worker-a@local.test', 'Worker A', 'active')", [userA, tenantA]);
  });
  await withTenantAdmin(tenantB, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'worker-b@local.test', 'Worker B', 'active')", [userB, tenantB]);
  });
}

function contextForToken(token) {
  const isB = token === "tenant-b";
  return {
    tenant: { tenantId: isB ? tenantB : tenantA, companyName: isB ? "Workforce Smoke Tenant B" : "Workforce Smoke Tenant A" },
    actor: {
      userId: isB ? userB : userA,
      role: "admin",
      roles: ["admin"],
      capabilities: ["workforce.read", "workforce.manage"],
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
    workforceRepository,
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

  const create = await request("tenant-a", "/api/workforce/workers", {
    method: "POST",
    body: {
      userId: userA,
      name: "Trabajador Smoke A",
      trade: "Tile installer",
      emergencyContactName: "Contacto A",
      emergencyContactPhone: "+1 555 0101",
      preferredLanguage: "en-US",
      notes: "Fixture temporal",
    },
  });
  workerAId = create.body.worker?.workerId;
  check("Tenant A crea trabajador", create.status === 201 && Boolean(workerAId), JSON.stringify(create.body));

  const listA = await request("tenant-a", "/api/workforce/workers");
  check("Tenant A ve trabajador", listA.status === 200 && listA.body.items.some((item) => item.workerId === workerAId), JSON.stringify(listA.body));

  const listB = await request("tenant-b", "/api/workforce/workers");
  check("Tenant B no ve trabajador A", listB.status === 200 && !listB.body.items.some((item) => item.workerId === workerAId), JSON.stringify(listB.body));

  const detailB = await request("tenant-b", `/api/workforce/workers/${workerAId}`);
  check("Tenant B no lee detalle A", detailB.status === 404, JSON.stringify(detailB.body));

  const updateA = await request("tenant-a", `/api/workforce/workers/${workerAId}`, {
    method: "PATCH",
    body: { status: "suspended", trade: "Supervisor" },
  });
  check("Tenant A actualiza trabajador", updateA.status === 200 && updateA.body.worker?.status === "suspended", JSON.stringify(updateA.body));

  const auditCount = await withTenantAdmin(tenantA, (client) =>
    client.query("SELECT count(*)::integer AS total FROM audit_events WHERE tenant_id = $1 AND module_id = 'workforce'", [tenantA]),
  );
  check("Operaciones workforce generan auditoria", auditCount.rows[0].total >= 2, JSON.stringify(auditCount.rows[0]));
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await workforceRepository?.close?.();
  for (const tenantId of [tenantA, tenantB]) {
    await withTenantAdmin(tenantId, async (client) => {
      await client.query("DELETE FROM worker_certifications WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM worker_availability WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM worker_profiles WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM workers WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
    }).catch(() => {});
  }
  await adminPool.query("DELETE FROM tenants WHERE tenant_id = ANY($1::uuid[])", [[tenantA, tenantB]]).catch(() => {});
  await adminPool.end();
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Workforce local smoke failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Workforce local smoke passed with ${checks.length} checks.`);
