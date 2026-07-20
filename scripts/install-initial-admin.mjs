import { randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import pg from "pg";
import { runtimeApiRoutes } from "../server/runtime/runtimeRoutes.mjs";

const { Client } = pg;
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=")];
  }),
);

const databaseUrl = process.env.DATABASE_URL;
const company = args.get("company");
const email = normalizeEmail(args.get("admin-email"));
const adminName = args.get("admin-name") || "Initial Admin";
const passwordFromEnv = process.env.INITIAL_ADMIN_PASSWORD;
const generatedPassword = passwordFromEnv ? null : generateTemporaryPassword();
const password = passwordFromEnv || generatedPassword;

if (!databaseUrl) {
  console.error("DATABASE_URL is required before creating the initial admin.");
  process.exit(1);
}

if (!company || !email) {
  console.error("Usage: npm run install:admin -- --company=\"Company Name\" --admin-email=admin@example.com [--admin-name=\"Admin Name\"]");
  console.error("Optional: set INITIAL_ADMIN_PASSWORD to avoid a generated temporary password.");
  process.exit(1);
}

if (password.length < 14) {
  console.error("INITIAL_ADMIN_PASSWORD must be at least 14 characters.");
  process.exit(1);
}

const tenantId = args.get("tenant-id") || randomUUID();
const adminUserId = args.get("admin-user-id") || randomUUID();
const passwordHash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});

const capabilities = Array.from(
  new Map(
    runtimeApiRoutes.map((route) => [
      route.capability,
      {
        code: route.capability,
        moduleId: route.moduleId,
        description: `Runtime capability ${route.capability}`,
      },
    ]),
  ).values(),
).sort((a, b) => a.code.localeCompare(b.code));

const client = new Client({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : false,
});

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);

  await client.query(
    `
      INSERT INTO tenants (tenant_id, name, industry_profile, locale, currency, timezone)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tenant_id) DO UPDATE
      SET name = EXCLUDED.name,
          industry_profile = EXCLUDED.industry_profile,
          locale = EXCLUDED.locale,
          currency = EXCLUDED.currency,
          timezone = EXCLUDED.timezone,
          updated_at = now()
    `,
    [
      tenantId,
      company,
      args.get("industry") || "construction",
      args.get("locale") || "es-US",
      args.get("currency") || "USD",
      args.get("timezone") || "America/Denver",
    ],
  );

  await ensureRoles(client, tenantId);
  await ensureCapabilities(client);

  await client.query(
    `
      INSERT INTO users (user_id, tenant_id, email, display_name, status)
      VALUES ($1, $2, $3, $4, 'active')
      ON CONFLICT (tenant_id, email) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          status = 'active',
          updated_at = now()
    `,
    [adminUserId, tenantId, email, adminName],
  );

  const userId = await scalar(
    client,
    "SELECT user_id FROM users WHERE tenant_id = $1 AND lower(email) = lower($2)",
    [tenantId, email],
  );
  const adminRoleId = await scalar(client, "SELECT role_id FROM roles WHERE tenant_id = $1 AND code = 'admin'", [tenantId]);

  await client.query(
    `
      INSERT INTO user_roles (tenant_id, user_id, role_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, role_id) DO NOTHING
    `,
    [tenantId, userId, adminRoleId],
  );

  await client.query(
    `
      INSERT INTO auth_password_credentials (tenant_id, user_id, password_hash, password_algorithm)
      VALUES ($1, $2, $3, 'argon2id')
      ON CONFLICT (tenant_id, user_id) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          password_algorithm = 'argon2id',
          password_updated_at = now()
    `,
    [tenantId, userId, passwordHash],
  );

  await client.query(
    `
      INSERT INTO tenant_licenses (
        tenant_id,
        license_code,
        status,
        plan_code,
        starts_at,
        expires_at,
        duration_preset,
        seats_limit,
        storage_quota_mb,
        features
      )
      VALUES (
        $1,
        $2,
        'active',
        'starter',
        now(),
        now() + interval '1 year',
        'one_year',
        5,
        500,
        '{"marketingAddon": false, "photoEvidenceAddon": false}'::jsonb
      )
      ON CONFLICT (tenant_id) DO NOTHING
    `,
    [tenantId, `LIC-${tenantId.replace(/-/g, "").slice(0, 12).toUpperCase()}`],
  );

  await client.query(
    `
      INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, $2, 'install.initial_admin_ready', 'auth', 'user', $2, 'info', $3::jsonb)
    `,
    [
      tenantId,
      userId,
      JSON.stringify({
        source: "install-initial-admin",
        passwordStored: "argon2id-hash-only",
        mfaRequired: true,
      }),
    ],
  );

  await client.query("COMMIT");

  console.log(JSON.stringify(
    {
      status: "ok",
      tenantId,
      adminEmail: email,
      generatedTemporaryPassword: Boolean(generatedPassword),
      temporaryPassword: generatedPassword || undefined,
      nextStep: "Login will require TOTP setup before the admin receives a session.",
    },
    null,
    2,
  ));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(error.message || error);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}

async function ensureRoles(client, tenantId) {
  const roles = [
    ["admin", "Administrador", "tenant"],
    ["manager", "Gestor", "tenant"],
    ["worker", "Trabajador", "tenant"],
  ];

  for (const [code, label, scope] of roles) {
    await client.query(
      `
        INSERT INTO roles (tenant_id, code, label, scope)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (tenant_id, code) DO UPDATE
        SET label = EXCLUDED.label,
            scope = EXCLUDED.scope
      `,
      [tenantId, code, label, scope],
    );
  }
}

async function ensureCapabilities(client) {
  for (const capability of capabilities) {
    await client.query(
      `
        INSERT INTO capabilities (code, module_id, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (code) DO UPDATE
        SET module_id = EXCLUDED.module_id,
            description = EXCLUDED.description
      `,
      [capability.code, capability.moduleId, capability.description],
    );
  }

  await client.query(
    `
      INSERT INTO role_capabilities (role_id, capability_id)
      SELECT r.role_id, c.capability_id
      FROM roles r
      CROSS JOIN capabilities c
      WHERE r.code = 'admin'
        AND r.scope = 'tenant'
        AND c.code NOT LIKE 'superadmin.%'
      ON CONFLICT (role_id, capability_id) DO NOTHING
    `,
  );
}

async function scalar(client, sql, params) {
  const result = await client.query(sql, params);
  return Object.values(result.rows[0] || {})[0];
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function generateTemporaryPassword() {
  return randomBytes(18).toString("base64url");
}
