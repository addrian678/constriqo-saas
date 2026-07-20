import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL || process.env.ADMIN_DATABASE_URL || process.env.MIGRATION_DATABASE_URL;
const tenantId = process.env.RESET_MFA_TENANT_ID;
const email = String(process.env.RESET_MFA_EMAIL || "").trim().toLowerCase();
const confirm = process.env.RESET_MFA_CONFIRM;
const expectedConfirm = "I_UNDERSTAND_THIS_RESETS_USER_MFA";

if (!databaseUrl) {
  console.error("DATABASE_URL, ADMIN_DATABASE_URL or MIGRATION_DATABASE_URL is required.");
  process.exit(1);
}

if (!tenantId || !email) {
  console.error("RESET_MFA_TENANT_ID and RESET_MFA_EMAIL are required.");
  process.exit(1);
}

if (confirm !== expectedConfirm) {
  console.error(`RESET_MFA_CONFIRM must be exactly ${expectedConfirm}.`);
  process.exit(1);
}

if (process.env.APP_ENV === "production" && process.env.RESET_MFA_ALLOW_PRODUCTION !== "true") {
  console.error("Production MFA reset requires RESET_MFA_ALLOW_PRODUCTION=true and should follow the security runbook.");
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : false,
});

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);

  const user = await client.query(
    `
      SELECT user_id, email
      FROM users
      WHERE tenant_id = $1
        AND lower(email) = lower($2)
      LIMIT 1
    `,
    [tenantId, email],
  );

  if (!user.rows[0]) {
    throw new Error("User not found for tenant.");
  }

  const userId = user.rows[0].user_id;

  const factors = await client.query(
    `
      UPDATE auth_mfa_factors
      SET status = 'revoked',
          updated_at = now()
      WHERE tenant_id = $1
        AND user_id = $2
        AND factor_type = 'totp'
        AND status IN ('pending', 'enabled')
      RETURNING factor_id
    `,
    [tenantId, userId],
  );

  const challenges = await client.query(
    `
      UPDATE auth_mfa_challenges
      SET status = 'expired'
      WHERE tenant_id = $1
        AND user_id = $2
        AND status = 'pending'
      RETURNING challenge_id
    `,
    [tenantId, userId],
  );

  const sessions = await client.query(
    `
      UPDATE auth_sessions
      SET status = 'revoked',
          revoked_at = now()
      WHERE tenant_id = $1
        AND user_id = $2
        AND status = 'active'
      RETURNING session_id
    `,
    [tenantId, userId],
  );

  await client.query(
    `
      INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, $2, 'auth.mfa.reset', 'auth', 'user', $2, 'warning', $3::jsonb)
    `,
    [
      tenantId,
      userId,
      JSON.stringify({
        source: "reset-user-mfa",
        email,
        revokedFactors: factors.rowCount,
        expiredChallenges: challenges.rowCount,
        revokedSessions: sessions.rowCount,
        appEnv: process.env.APP_ENV || "development",
      }),
    ],
  );

  await client.query("COMMIT");
  console.log(JSON.stringify(
    {
      status: "ok",
      tenantId,
      email,
      revokedFactors: factors.rowCount,
      expiredChallenges: challenges.rowCount,
      revokedSessions: sessions.rowCount,
      nextStep: "Login again with the same password. The admin will be asked to configure TOTP again.",
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
