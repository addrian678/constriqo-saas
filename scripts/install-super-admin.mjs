import { randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import pg from "pg";

const PROVIDER_TENANT_ID = "00000000-0000-4000-8000-000000000001";
const { Client } = pg;
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=")];
  }),
);

const databaseUrl = process.env.DATABASE_URL || process.env.ADMIN_DATABASE_URL;
const email = normalizeEmail(args.get("email") || process.env.SUPER_ADMIN_EMAIL || "superadmin@local.test");
const displayName = args.get("name") || process.env.SUPER_ADMIN_NAME || "ConstructFlow Super Admin";
const passwordFromEnv = process.env.SUPER_ADMIN_PASSWORD;
const generatedPassword = passwordFromEnv ? null : generateTemporaryPassword();
const password = passwordFromEnv || generatedPassword;

if (!databaseUrl) {
  console.error("DATABASE_URL or ADMIN_DATABASE_URL is required before creating the Super Admin.");
  process.exit(1);
}

if (password.length < 14) {
  console.error("SUPER_ADMIN_PASSWORD must be at least 14 characters.");
  process.exit(1);
}

const userId = args.get("user-id") || randomUUID();
const passwordHash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});

const client = new Client({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : false,
});

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [PROVIDER_TENANT_ID]);

  await client.query(
    `
      INSERT INTO tenants (tenant_id, name, industry_profile, locale, currency, timezone)
      VALUES ($1, 'ConstructFlow Provider', 'provider', 'es-ES', 'EUR', 'Europe/Madrid')
      ON CONFLICT (tenant_id) DO UPDATE
      SET name = EXCLUDED.name,
          industry_profile = EXCLUDED.industry_profile,
          updated_at = now()
    `,
    [PROVIDER_TENANT_ID],
  );

  await client.query(
    `
      INSERT INTO capabilities (code, module_id, description)
      VALUES
        ('superadmin.read', 'super-admin', 'Read provider-level tenant and license status.'),
        ('superadmin.manage', 'super-admin', 'Manage provider-level tenant licenses.')
      ON CONFLICT (code) DO UPDATE
      SET module_id = EXCLUDED.module_id,
          description = EXCLUDED.description
    `,
  );

  await client.query(
    `
      INSERT INTO roles (tenant_id, code, label, scope)
      VALUES ($1, 'super_admin', 'Super Admin proveedor', 'global')
      ON CONFLICT (tenant_id, code) DO UPDATE
      SET label = EXCLUDED.label,
          scope = EXCLUDED.scope
    `,
    [PROVIDER_TENANT_ID],
  );

  await client.query(
    `
      INSERT INTO role_capabilities (role_id, capability_id)
      SELECT r.role_id, c.capability_id
      FROM roles r
      JOIN capabilities c ON c.code IN ('superadmin.read', 'superadmin.manage')
      WHERE r.tenant_id = $1 AND r.code = 'super_admin'
      ON CONFLICT (role_id, capability_id) DO NOTHING
    `,
    [PROVIDER_TENANT_ID],
  );

  await client.query(
    `
      INSERT INTO users (user_id, tenant_id, email, display_name, status)
      VALUES ($1, $2, $3, $4, 'active')
      ON CONFLICT (tenant_id, email) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          status = 'active',
          updated_at = now()
    `,
    [userId, PROVIDER_TENANT_ID, email, displayName],
  );

  const resolvedUserId = await scalar(client, "SELECT user_id FROM users WHERE tenant_id = $1 AND lower(email) = lower($2)", [
    PROVIDER_TENANT_ID,
    email,
  ]);
  const roleId = await scalar(client, "SELECT role_id FROM roles WHERE tenant_id = $1 AND code = 'super_admin'", [PROVIDER_TENANT_ID]);

  await client.query(
    `
      INSERT INTO user_roles (tenant_id, user_id, role_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, role_id) DO NOTHING
    `,
    [PROVIDER_TENANT_ID, resolvedUserId, roleId],
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
    [PROVIDER_TENANT_ID, resolvedUserId, passwordHash],
  );

  await client.query(
    `
      INSERT INTO super_admin_audit_events (actor_user_id, actor_email, action, target_tenant_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, $2, 'super_admin.install.ready', $3, 'user', $1, 'info', $4::jsonb)
      ON CONFLICT DO NOTHING
    `,
    [
      resolvedUserId,
      email,
      PROVIDER_TENANT_ID,
      JSON.stringify({
        source: "install-super-admin",
        passwordStored: "argon2id-hash-only",
        mfaRequired: true,
      }),
    ],
  );

  await client.query("COMMIT");

  console.log(JSON.stringify(
    {
      status: "ok",
      tenantId: PROVIDER_TENANT_ID,
      superAdminEmail: email,
      generatedTemporaryPassword: Boolean(generatedPassword),
      temporaryPassword: generatedPassword || undefined,
      nextStep: "Login will require TOTP setup before the Super Admin receives a session.",
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
