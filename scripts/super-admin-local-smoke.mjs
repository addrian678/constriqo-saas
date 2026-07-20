import { randomUUID } from "node:crypto";
import pg from "pg";
import { createRuntimeServer } from "../server/runtime/server.mjs";
import { createPostgresAuthRepository } from "../server/runtime/postgresAuthRepository.mjs";
import { createPostgresSuperAdminRepository } from "../server/runtime/postgresSuperAdminRepository.mjs";

const { Pool } = pg;
const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;

if (!adminDatabaseUrl) {
  console.error("ADMIN_DATABASE_URL or DATABASE_URL is required for Super Admin smoke.");
  process.exit(1);
}

const adminPool = new Pool({
  connectionString: adminDatabaseUrl,
  max: 2,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : false,
});

const tenantA = randomUUID();
let createdTenantId = null;

async function main() {
  await adminPool.query(
    `
      INSERT INTO tenants (tenant_id, name, industry_profile, locale, currency, timezone)
      VALUES ($1, 'Smoke Super Admin Tenant', 'construction', 'en-US', 'USD', 'America/Denver')
    `,
    [tenantA],
  );

  const repository = createPostgresSuperAdminRepository(adminPool);
  const server = createRuntimeServer({
    superAdminRepository: repository,
    organizationRepository: null,
    sessionContextResolver: {
      async resolve({ authorizationHeader }) {
        const token = String(authorizationHeader || "").replace(/^Bearer\s+/iu, "");
        if (token === "super") {
          return {
            requestId: "super-admin-smoke",
            tenant: { tenantId: "00000000-0000-4000-8000-000000000001", companyName: "Constriqo Provider" },
            actor: {
              userId: null,
              email: "superadmin-smoke@local.test",
              role: "super_admin",
              roles: ["super_admin"],
              capabilities: ["superadmin.read", "superadmin.manage"],
            },
          };
        }
        return {
          requestId: "super-admin-smoke",
          tenant: { tenantId: tenantA, companyName: "Regular Tenant" },
          actor: {
            userId: null,
            email: "regular@local.test",
            role: "admin",
            roles: ["admin"],
            capabilities: ["clients.read"],
          },
        };
      },
    },
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const forbidden = await request(port, "regular", "/api/super-admin/tenants");
    assert(forbidden.status === 403, "non-super cannot list tenants");

    const list = await request(port, "super", "/api/super-admin/tenants");
    assert(list.status === 200, "super can list tenants");
    assert(list.body.items.some((tenant) => tenant.tenantId === tenantA), "tenant A visible to Super Admin");

    const updated = await request(port, "super", `/api/super-admin/tenants/${tenantA}/license`, {
      method: "PATCH",
      body: {
        status: "active",
        planCode: "growth",
        durationPreset: "two_years",
        seatsLimit: 12,
        storageQuotaMb: 2048,
        features: { marketingAddon: true, photoEvidenceAddon: false },
        notes: "Smoke two_years license",
      },
    });
    assert(updated.status === 200, "super can update tenant license");
    assert(updated.body.license.durationPreset === "two_years", "two_years preset saved");
    assert(updated.body.license.planCode === "growth", "plan saved");

    const trial = await request(port, "super", `/api/super-admin/tenants/${tenantA}/license`, {
      method: "PATCH",
      body: {
        status: "trial",
        planCode: "starter",
        durationPreset: "trial_7d",
        seatsLimit: 5,
        storageQuotaMb: 500,
      },
    });
    assert(trial.status === 200, "super can switch tenant to trial");
    assert(trial.body.license.status === "trial", "trial status saved");

    const created = await request(port, "super", "/api/super-admin/tenants", {
      method: "POST",
      body: {
        companyName: "Smoke Created Tenant",
        adminName: "Smoke Admin",
        adminEmail: "smoke-created-admin@local.test",
        industryProfile: "construction",
        currency: "USD",
        durationPreset: "trial_30d",
        status: "trial",
        planCode: "starter",
        seatsLimit: 5,
        storageQuotaMb: 500,
      },
    });
    assert(created.status === 201, "super can create tenant with initial admin");
    createdTenantId = created.body.tenant.tenantId;
    assert(created.body.initialAdmin.temporaryPassword.length >= 14, "temporary admin password generated");

    const authRepository = createPostgresAuthRepository(adminPool, { requireAdminMfa: true });
    const activeLogin = await authRepository.login({
      tenantId: createdTenantId,
      email: created.body.initialAdmin.email,
      password: created.body.initialAdmin.temporaryPassword,
    });
    assert(activeLogin.status === 202 && activeLogin.body.code === "MFA_SETUP_REQUIRED", "active license allows admin MFA setup");

    const suspended = await request(port, "super", `/api/super-admin/tenants/${createdTenantId}/license`, {
      method: "PATCH",
      body: {
        status: "suspended",
        planCode: "starter",
        durationPreset: "one_year",
        seatsLimit: 5,
        storageQuotaMb: 500,
      },
    });
    assert(suspended.status === 200, "super can suspend tenant license");
    const blockedLogin = await authRepository.login({
      tenantId: createdTenantId,
      email: created.body.initialAdmin.email,
      password: created.body.initialAdmin.temporaryPassword,
    });
    assert(blockedLogin.status === 403 && blockedLogin.body.code === "LICENSE_SUSPENDED", "suspended license blocks tenant login");

    console.log("Super Admin local smoke passed.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function request(port, token, path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Smoke assertion failed: ${message}`);
  }
  console.log(`ok - ${message}`);
}

try {
  await main();
} finally {
  await cleanupTenant(tenantA).catch(() => {});
  if (createdTenantId) {
    await cleanupTenant(createdTenantId).catch(() => {});
  }
  await adminPool.end().catch(() => {});
}

async function cleanupTenant(tenantId) {
  const client = await adminPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    await client.query("DELETE FROM tenant_licenses WHERE tenant_id = $1", [tenantId]);
    await client.query("DELETE FROM super_admin_audit_events WHERE target_tenant_id = $1", [tenantId]);
    await client.query("DELETE FROM auth_mfa_challenges WHERE tenant_id = $1", [tenantId]).catch(() => {});
    await client.query("DELETE FROM auth_mfa_factors WHERE tenant_id = $1", [tenantId]).catch(() => {});
    await client.query("DELETE FROM auth_recovery_codes WHERE tenant_id = $1", [tenantId]).catch(() => {});
    await client.query("DELETE FROM auth_sessions WHERE tenant_id = $1", [tenantId]).catch(() => {});
    await client.query("DELETE FROM auth_login_attempts WHERE tenant_id = $1", [tenantId]).catch(() => {});
    await client.query("DELETE FROM auth_password_credentials WHERE tenant_id = $1", [tenantId]).catch(() => {});
    await client.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]).catch(() => {});
    await client.query("DELETE FROM user_roles WHERE tenant_id = $1", [tenantId]).catch(() => {});
    await client.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]).catch(() => {});
    await client.query("DELETE FROM role_capabilities WHERE role_id IN (SELECT role_id FROM roles WHERE tenant_id = $1)", [tenantId]).catch(() => {});
    await client.query("DELETE FROM roles WHERE tenant_id = $1", [tenantId]).catch(() => {});
    await client.query("DELETE FROM tenants WHERE tenant_id = $1", [tenantId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
