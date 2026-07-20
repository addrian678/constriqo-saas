import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createRuntimeAuthServiceFromEnv, createRuntimeServer } from "../server/runtime/server.mjs";
import { createPostgresWorkforceRepositoryFromEnv } from "../server/runtime/postgresWorkforceRepository.mjs";

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

if (!adminDatabaseUrl || !runtimeDatabaseUrl) {
  console.log("Worker user local smoke skipped: ADMIN_DATABASE_URL and RUNTIME_DATABASE_URL are required.");
  process.exit(0);
}

const tenantA = randomUUID();
const tenantB = randomUUID();
const adminA = randomUUID();
const adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 2 });
const workforceRepository = createPostgresWorkforceRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
const authService = createRuntimeAuthServiceFromEnv({
  DATABASE_URL: runtimeDatabaseUrl,
  SESSION_TOKEN_PEPPER: process.env.SESSION_TOKEN_PEPPER || "local-dev-session-pepper-change-me",
  AUTH_MFA_ENCRYPTION_KEY: process.env.AUTH_MFA_ENCRYPTION_KEY || "local-dev-mfa-key-change-me",
});
let server;
let address;
let workerId;
let workerUserId;
let workerEmail;
let temporaryPassword;

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

async function ensureCapabilities(client, tenantId) {
  const capabilities = [
    ["workforce.read", "workforce", "Read workforce"],
    ["workforce.manage", "workforce", "Manage workforce"],
    ["worker.tasks.read", "worker-self", "Read own tasks"],
    ["worker.tasks.update", "worker-self", "Update own tasks"],
  ];
  for (const [code, moduleId, description] of capabilities) {
    await client.query(
      "INSERT INTO capabilities (code, module_id, description) VALUES ($1, $2, $3) ON CONFLICT (code) DO UPDATE SET module_id = EXCLUDED.module_id, description = EXCLUDED.description",
      [code, moduleId, description],
    );
  }
  await client.query(
    `
      INSERT INTO role_capabilities (role_id, capability_id)
      SELECT r.role_id, c.capability_id
      FROM roles r
      JOIN capabilities c ON
        (r.code = 'admin' AND c.code IN ('workforce.read', 'workforce.manage', 'worker.tasks.read', 'worker.tasks.update'))
        OR (r.code = 'worker' AND c.code IN ('worker.tasks.read', 'worker.tasks.update'))
      WHERE r.tenant_id = $1
      ON CONFLICT (role_id, capability_id) DO NOTHING
    `,
    [tenantId],
  );
}

async function setupFixtures() {
  await adminPool.query(
    `
      INSERT INTO tenants (tenant_id, name, industry_profile, locale, currency, timezone)
      VALUES
        ($1, 'Worker User Tenant A', 'construction', 'es-US', 'USD', 'America/Denver'),
        ($2, 'Worker User Tenant B', 'construction', 'es-US', 'USD', 'America/Denver')
    `,
    [tenantA, tenantB],
  );
  for (const tenantId of [tenantA, tenantB]) {
    await withTenantAdmin(tenantId, async (client) => {
      await client.query(
        `
          INSERT INTO roles (tenant_id, code, label, scope)
          VALUES
            ($1, 'admin', 'Administrador', 'tenant'),
            ($1, 'worker', 'Trabajador', 'tenant')
          ON CONFLICT (tenant_id, code) DO NOTHING
        `,
        [tenantId],
      );
      await client.query(
        `
          INSERT INTO tenant_licenses (tenant_id, license_code, status, plan_code, expires_at, duration_preset, seats_limit, storage_quota_mb)
          VALUES ($1, $2, 'active', 'starter', now() + interval '30 days', 'trial_30d', 10, 1024)
          ON CONFLICT (tenant_id) DO UPDATE
          SET status = 'active',
              expires_at = now() + interval '30 days',
              updated_at = now()
        `,
        [tenantId, `worker-user-smoke-${tenantId}`],
      );
      await ensureCapabilities(client, tenantId);
    });
  }
  await withTenantAdmin(tenantA, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'admin-worker-user@local.test', 'Admin Worker User', 'active')", [adminA, tenantA]);
    const adminRole = await client.query("SELECT role_id FROM roles WHERE tenant_id = $1 AND code = 'admin'", [tenantA]);
    await client.query("INSERT INTO user_roles (tenant_id, user_id, role_id) VALUES ($1, $2, $3)", [tenantA, adminA, adminRole.rows[0].role_id]);
  });
}

async function request(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
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
    authService,
    workforceRepository,
    sessionContextResolver: {
      async resolve() {
        return {
          tenant: { tenantId: tenantA, companyName: "Worker User Tenant A" },
          actor: {
            userId: adminA,
            role: "admin",
            roles: ["admin"],
            capabilities: ["workforce.read", "workforce.manage"],
          },
        };
      },
    },
  });
  address = await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address()));
  });

  workerEmail = `worker-user-${Date.now()}@local.test`;
  const create = await request("/api/workforce/worker-users", {
    method: "POST",
    token: "admin-a",
    body: {
      name: "Worker Login Smoke",
      email: workerEmail,
      trade: "Installer",
    },
  });
  workerId = create.body.worker?.workerId;
  workerUserId = create.body.user?.userId;
  temporaryPassword = create.body.temporaryPassword;
  check("Admin crea usuario trabajador", create.status === 201 && Boolean(workerId) && Boolean(workerUserId), JSON.stringify(create.body));
  check("API devuelve clave temporal una vez", typeof temporaryPassword === "string" && temporaryPassword.length >= 14, JSON.stringify(create.body));
  check("Acceso trabajador prepara email sandbox", create.body.emailDelivery?.status === "sandboxed" && create.body.emailDelivery?.templateKey === "worker.temporary_access", JSON.stringify(create.body.emailDelivery));

  const credential = await withTenantAdmin(tenantA, (client) =>
    client.query("SELECT password_hash FROM auth_password_credentials WHERE tenant_id = $1 AND user_id = $2", [tenantA, workerUserId]),
  );
  check("Password queda hasheado con Argon2", credential.rows[0]?.password_hash?.startsWith("$argon2"), JSON.stringify(credential.rows[0]));

  const login = await request("/api/auth/login", {
    method: "POST",
    body: {
      tenantId: tenantA,
      email: workerEmail,
      password: temporaryPassword,
    },
  });
  check("Trabajador inicia sesion real sin MFA admin", login.status === 200 && login.body.user?.roles.includes("worker"), JSON.stringify(login.body));
  check("Trabajador recibe capacidades propias", login.body.user?.capabilities.includes("worker.tasks.read"), JSON.stringify(login.body.user));

  const wrongTenantLogin = await request("/api/auth/login", {
    method: "POST",
    body: {
      tenantId: tenantB,
      email: workerEmail,
      password: temporaryPassword,
    },
  });
  check("Trabajador no inicia sesion en otro tenant", wrongTenantLogin.status === 401, JSON.stringify(wrongTenantLogin.body));
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await workforceRepository?.close?.();
  await authService?.close?.();
  for (const tenantId of [tenantA, tenantB]) {
    await withTenantAdmin(tenantId, async (client) => {
      await client.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM email_deliveries WHERE tenant_id = $1", [tenantId]).catch(() => {});
      await client.query("DELETE FROM auth_sessions WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM auth_password_credentials WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM workers WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM user_roles WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM roles WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM tenant_licenses WHERE tenant_id = $1", [tenantId]).catch(() => {});
    }).catch(() => {});
  }
  await adminPool.query("DELETE FROM tenants WHERE tenant_id = ANY($1::uuid[])", [[tenantA, tenantB]]).catch(() => {});
  await adminPool.end();
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Worker user local smoke failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Worker user local smoke passed with ${checks.length} checks.`);
