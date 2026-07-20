import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createRuntimeServer } from "../server/runtime/server.mjs";
import { createPostgresReportsRepositoryFromEnv } from "../server/runtime/postgresReportsRepository.mjs";

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

if (!adminDatabaseUrl || !runtimeDatabaseUrl) {
  console.log("Reports local smoke skipped: ADMIN_DATABASE_URL and RUNTIME_DATABASE_URL are required.");
  process.exit(0);
}

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const clientA = randomUUID();
const jobA = randomUUID();
const workerA = randomUUID();
const adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 2 });
const reportsRepository = createPostgresReportsRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
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
        ($1, 'Reports Tenant A', 'construction', 'es-US', 'USD', 'America/Denver'),
        ($2, 'Reports Tenant B', 'construction', 'es-US', 'USD', 'America/Denver')
    `,
    [tenantA, tenantB],
  );
  await withTenantAdmin(tenantA, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'reports-a@local.test', 'Reports A', 'active')", [userA, tenantA]);
    await client.query("INSERT INTO clients (client_id, tenant_id, name, status) VALUES ($1, $2, 'Cliente reportes', 'active')", [clientA, tenantA]);
    await client.query("INSERT INTO jobs (job_id, tenant_id, client_id, job_number, title, status) VALUES ($1, $2, $3, 'JOB-RPT-001', 'Obra reportes', 'in_progress')", [jobA, tenantA, clientA]);
    await client.query("INSERT INTO job_tasks (tenant_id, job_id, title, status, created_by_user_id) VALUES ($1, $2, 'Tarea smoke', 'completed', $3)", [tenantA, jobA, userA]);
    await client.query("INSERT INTO workers (worker_id, tenant_id, name, status, trade) VALUES ($1, $2, 'Worker reportes', 'active', 'General')", [workerA, tenantA]);
    await client.query("INSERT INTO time_entries (tenant_id, worker_id, job_id, clock_in, clock_out, status) VALUES ($1, $2, $3, now() - interval '5 hours', now() - interval '1 hour', 'submitted')", [tenantA, workerA, jobA]);
    await client.query("INSERT INTO invoices (tenant_id, client_id, job_id, invoice_number, status, total_amount, balance_amount, currency) VALUES ($1, $2, $3, 'INV-RPT-001', 'issued', 1000, 250, 'USD')", [tenantA, clientA, jobA]);
    await client.query("INSERT INTO expenses (tenant_id, job_id, vendor_name, status, total_amount, balance_amount) VALUES ($1, $2, 'Proveedor reportes', 'approved', 300, 100)", [tenantA, jobA]);
    await client.query("INSERT INTO assets (tenant_id, code, name, category, status, book_value) VALUES ($1, 'AST-RPT-001', 'Activo reportes', 'Equipo', 'active', 500)", [tenantA]);
    await client.query("INSERT INTO liabilities (tenant_id, reference, lender, status, principal_amount, balance_amount) VALUES ($1, 'PAS-RPT-001', 'Banco reportes', 'active', 400, 200)", [tenantA]);
    await client.query("INSERT INTO marketing_campaigns (tenant_id, name, channel, status, budget_amount, created_by_user_id) VALUES ($1, 'Campana reportes', 'manual', 'active', 50, $2)", [tenantA, userA]);
    await client.query("INSERT INTO marketing_leads (tenant_id, name, source, status, consent_status) VALUES ($1, 'Lead reportes', 'web', 'converted', 'accepted')", [tenantA]);
    await client.query("INSERT INTO marketing_loyalty_cards (tenant_id, card_code, title, required_stamps, current_stamps, reward_type, reward_value, reward_description, status, created_by_user_id) VALUES ($1, 'LOY-RPT-001', 'Tarjeta reportes', 10, 10, 'discount_percent', 20, '20%', 'active', $2)", [tenantA, userA]);
    await client.query("INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, severity) VALUES ($1, $2, 'reports.fixture', 'reports', 'fixture', 'info')", [tenantA, userA]);
    await client.query("INSERT INTO notification_queue (tenant_id, audience_role, channel, title, message, severity) VALUES ($1, 'admin', 'in_app', 'Reporte pendiente', 'Smoke', 'info')", [tenantA]);
  });
  await withTenantAdmin(tenantB, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'reports-b@local.test', 'Reports B', 'active')", [userB, tenantB]);
  });
}

function contextForToken(token) {
  const isB = token === "tenant-b";
  return {
    tenant: { tenantId: isB ? tenantB : tenantA, companyName: isB ? "Reports Tenant B" : "Reports Tenant A" },
    actor: {
      userId: isB ? userB : userA,
      role: "admin",
      roles: ["admin"],
      capabilities: ["reports.read"],
    },
  };
}

async function request(token, path) {
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: "GET",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
  });
  return {
    status: response.status,
    body: await response.json(),
  };
}

try {
  await setupFixtures();
  server = createRuntimeServer({
    reportsRepository,
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

  const reportA = await request("tenant-a", "/api/reports/summary");
  check("Tenant A ve reporte real", reportA.status === 200 && reportA.body.report?.financial?.income >= 1000 && reportA.body.report?.marketing?.readyLoyaltyCards === 1, JSON.stringify(reportA.body));

  const reportB = await request("tenant-b", "/api/reports/summary");
  check("Tenant B no ve datos A", reportB.status === 200 && reportB.body.report?.financial?.income === 0 && reportB.body.report?.operations?.clients === 0, JSON.stringify(reportB.body));
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await reportsRepository?.close?.();
  for (const tenantId of [tenantA, tenantB]) {
    await withTenantAdmin(tenantId, async (client) => {
      await client.query("DELETE FROM notification_queue WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM marketing_loyalty_cards WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM marketing_leads WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM marketing_campaigns WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM liabilities WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM assets WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM expenses WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM invoices WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM time_entries WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM job_tasks WHERE tenant_id = $1", [tenantId]);
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
  console.error(`Reports local smoke failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Reports local smoke passed with ${checks.length} checks.`);
