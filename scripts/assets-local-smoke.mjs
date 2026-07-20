import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createRuntimeServer } from "../server/runtime/server.mjs";
import { createPostgresAssetsRepositoryFromEnv } from "../server/runtime/postgresAssetsRepository.mjs";
import { createPostgresFinanceRepositoryFromEnv } from "../server/runtime/postgresFinanceRepository.mjs";

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

if (!adminDatabaseUrl || !runtimeDatabaseUrl) {
  console.log("Assets local smoke skipped: ADMIN_DATABASE_URL and RUNTIME_DATABASE_URL are required.");
  process.exit(0);
}

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 2 });
const assetsRepository = createPostgresAssetsRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
const financeRepository = createPostgresFinanceRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
let server;
let address;
let assetAId;
let liabilityAId;

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
        ($1, 'Assets Tenant A', 'construction', 'es-US', 'USD', 'America/Denver'),
        ($2, 'Assets Tenant B', 'construction', 'es-US', 'USD', 'America/Denver')
    `,
    [tenantA, tenantB],
  );
  await withTenantAdmin(tenantA, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'assets-a@local.test', 'Assets A', 'active')", [userA, tenantA]);
  });
  await withTenantAdmin(tenantB, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'assets-b@local.test', 'Assets B', 'active')", [userB, tenantB]);
  });
}

function contextForToken(token) {
  const isB = token === "tenant-b";
  return {
    tenant: { tenantId: isB ? tenantB : tenantA, companyName: isB ? "Assets Tenant B" : "Assets Tenant A" },
    actor: {
      userId: isB ? userB : userA,
      role: "admin",
      roles: ["admin"],
      capabilities: ["assets.read", "assets.manage", "liabilities.read", "liabilities.manage", "finance.read", "cashflow.read", "finance.manage"],
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
    assetsRepository,
    financeRepository,
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

  const asset = await request("tenant-a", "/api/assets", {
    method: "POST",
    body: { name: "Compresor smoke", category: "Equipo", bookValue: 2400, warrantyExpiresAt: "2027-01-15" },
  });
  assetAId = asset.body.asset?.assetId;
  check("Tenant A crea activo", asset.status === 201 && asset.body.asset?.code && asset.body.asset?.bookValue === 2400, JSON.stringify(asset.body));

  const liability = await request("tenant-a", "/api/liabilities", {
    method: "POST",
    body: { lender: "Banco smoke", principalAmount: 9000, balanceAmount: 7200, nextDueDate: "2026-08-15" },
  });
  liabilityAId = liability.body.liability?.liabilityId;
  check("Tenant A crea pasivo", liability.status === 201 && liability.body.liability?.reference && liability.body.liability?.balanceAmount === 7200, JSON.stringify(liability.body));

  const assetListA = await request("tenant-a", "/api/assets");
  check("Tenant A ve activo", assetListA.status === 200 && assetListA.body.items.some((item) => item.assetId === assetAId), JSON.stringify(assetListA.body));

  const liabilityListA = await request("tenant-a", "/api/liabilities");
  check("Tenant A ve pasivo", liabilityListA.status === 200 && liabilityListA.body.items.some((item) => item.liabilityId === liabilityAId), JSON.stringify(liabilityListA.body));

  const assetListB = await request("tenant-b", "/api/assets");
  check("Tenant B no ve activo A", assetListB.status === 200 && !assetListB.body.items.some((item) => item.assetId === assetAId), JSON.stringify(assetListB.body));

  const liabilityListB = await request("tenant-b", "/api/liabilities");
  check("Tenant B no ve pasivo A", liabilityListB.status === 200 && !liabilityListB.body.items.some((item) => item.liabilityId === liabilityAId), JSON.stringify(liabilityListB.body));

  const dashboard = await request("tenant-a", "/api/finance/dashboard");
  check(
    "Dashboard refleja activo y pasivo",
    dashboard.status === 200 && dashboard.body.dashboard?.summary?.assets >= 2400 && dashboard.body.dashboard?.summary?.liabilities >= 7200,
    JSON.stringify(dashboard.body),
  );

  const audit = await withTenantAdmin(tenantA, (client) =>
    client.query("SELECT count(*)::integer AS total FROM audit_events WHERE tenant_id = $1 AND module_id = 'assets-liabilities'", [tenantA]),
  );
  check("Activos y pasivos generan auditoria", audit.rows[0].total >= 2, JSON.stringify(audit.rows[0]));
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await assetsRepository?.close?.();
  await financeRepository?.close?.();
  for (const tenantId of [tenantA, tenantB]) {
    await withTenantAdmin(tenantId, async (client) => {
      await client.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM liabilities WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM assets WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM financial_transactions WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM financial_reconciliations WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM financial_accounts WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
    }).catch(() => {});
  }
  await adminPool.query("DELETE FROM tenants WHERE tenant_id = ANY($1::uuid[])", [[tenantA, tenantB]]).catch(() => {});
  await adminPool.end();
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Assets local smoke failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Assets local smoke passed with ${checks.length} checks.`);
