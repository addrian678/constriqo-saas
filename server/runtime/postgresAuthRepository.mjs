import pg from "pg";
import {
  addHours,
  createTotpAuthUri,
  decryptSecret,
  encryptSecret,
  generateSessionToken,
  generateTotpSecret,
  hashSessionToken,
  verifyPassword,
  verifyTotpCode,
} from "./cryptoAuth.mjs";

const { Pool } = pg;
const SESSION_EXPIRY_HOURS = 12;
const MFA_CHALLENGE_EXPIRY_MINUTES = 10;
const FAILED_LOGIN_WINDOW_MINUTES = 15;
const FAILED_LOGIN_LIMIT = 8;

export function createPostgresPoolFromEnv(env = process.env) {
  if (!env.DATABASE_URL) {
    return null;
  }

  return new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_SSL === "true" ? { rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : false,
    max: Number(env.DATABASE_POOL_MAX || 10),
    connectionTimeoutMillis: Number(env.DATABASE_CONNECTION_TIMEOUT_MS || 5000),
    idleTimeoutMillis: Number(env.DATABASE_IDLE_TIMEOUT_MS || 30000),
    statement_timeout: Number(env.DATABASE_STATEMENT_TIMEOUT_MS || 30000),
    query_timeout: Number(env.DATABASE_QUERY_TIMEOUT_MS || 35000),
    application_name: env.DATABASE_APPLICATION_NAME || "constructflow-runtime",
  });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function mapIdentity(row) {
  if (!row) {
    return null;
  }

  const roles = Array.isArray(row.roles) ? row.roles.filter(Boolean) : [];
  const capabilities = Array.isArray(row.capabilities) ? row.capabilities.filter(Boolean) : [];

  return {
    user: {
      userId: row.user_id,
      tenantId: row.tenant_id,
      email: row.email,
      displayName: row.display_name,
      status: row.status,
      roles,
      capabilities,
    },
    tenant: {
      tenantId: row.tenant_id,
      companyName: row.company_name,
    },
    passwordHash: row.password_hash,
    hasEnabledMfa: Boolean(row.has_enabled_mfa),
  };
}

function identitySelect(extraColumns = "") {
  return `
  SELECT
    u.user_id,
    u.tenant_id,
    u.email,
    u.display_name,
    u.status,
    t.name AS company_name,
    pc.password_hash,
    COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles,
    COALESCE(array_agg(DISTINCT c.code) FILTER (WHERE c.code IS NOT NULL), '{}') AS capabilities,
    EXISTS (
      SELECT 1
      FROM auth_mfa_factors mf
      WHERE mf.tenant_id = u.tenant_id
        AND mf.user_id = u.user_id
        AND mf.status = 'enabled'
        AND mf.factor_type = 'totp'
    ) AS has_enabled_mfa
    ${extraColumns}
  FROM users u
  JOIN tenants t ON t.tenant_id = u.tenant_id
  LEFT JOIN auth_password_credentials pc ON pc.tenant_id = u.tenant_id AND pc.user_id = u.user_id
  LEFT JOIN user_roles ur ON ur.tenant_id = u.tenant_id AND ur.user_id = u.user_id
  LEFT JOIN roles r ON r.tenant_id = u.tenant_id AND r.role_id = ur.role_id
  LEFT JOIN role_capabilities rc ON rc.role_id = r.role_id
  LEFT JOIN capabilities c ON c.capability_id = rc.capability_id
`;
}

export function createPostgresAuthRepository(pool, options = {}) {
  const sessionExpiryHours = Number(options.sessionExpiryHours || SESSION_EXPIRY_HOURS);
  const requireAdminMfa = options.requireAdminMfa !== false;
  const issuer = options.issuer || "ConstructFlow";
  const failedLoginWindowMinutes = Number(options.failedLoginWindowMinutes || FAILED_LOGIN_WINDOW_MINUTES);
  const failedLoginLimit = Number(options.failedLoginLimit || FAILED_LOGIN_LIMIT);

  async function recordLoginAttempt({ tenantId, email, succeeded, reason }) {
    await queryForTenant(
      tenantId,
      `
        INSERT INTO auth_login_attempts (tenant_id, email, succeeded, reason)
        VALUES ($1, $2, $3, $4)
      `,
      [tenantId || null, normalizeEmail(email), succeeded, reason],
    );
  }

  async function findIdentityByEmail(tenantId, email) {
    const resolvedTenantId = await resolveTenantIdentifier(tenantId);
    const result = await queryForTenant(
      resolvedTenantId,
      `
        ${identitySelect()}
        WHERE u.tenant_id = $1
          AND lower(u.email) = lower($2)
        GROUP BY u.user_id, u.tenant_id, u.email, u.display_name, u.status, t.name, pc.password_hash
      `,
      [resolvedTenantId, normalizeEmail(email)],
    );

    return mapIdentity(result.rows[0]);
  }

  async function resolveTenantIdentifier(input) {
    const text = String(input || "").trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(text)) {
      return text;
    }

    const result = await pool.query(
      `
        SELECT tenant_id
        FROM tenants
        WHERE tenant_slug = $1
        LIMIT 1
      `,
      [normalizeTenantSlug(text)],
    );
    const row = result.rows[0];
    if (!row) {
      const error = new Error("Credenciales invalidas.");
      error.status = 401;
      error.code = "INVALID_CREDENTIALS";
      throw error;
    }
    return row.tenant_id;
  }

  async function getFailedLoginPressure(tenantId, email) {
    const result = await queryForTenant(
      tenantId,
      `
        SELECT count(*)::integer AS failed_count
        FROM auth_login_attempts
        WHERE tenant_id = $1
          AND email = $2
          AND succeeded = false
          AND created_at >= now() - ($3::integer * interval '1 minute')
      `,
      [tenantId, normalizeEmail(email), failedLoginWindowMinutes],
    );

    return Number(result.rows[0]?.failed_count || 0);
  }

  async function findSessionByTokenHash(tokenHash, tenantId) {
    const result = await queryForTenant(
      tenantId,
      `
        ${identitySelect(", s.session_id, s.status AS session_status, s.expires_at AS session_expires_at")}
        JOIN auth_sessions s ON s.tenant_id = u.tenant_id AND s.user_id = u.user_id
        WHERE s.session_token_hash = $1
          AND s.status = 'active'
          AND s.expires_at > now()
        GROUP BY
          u.user_id,
          u.tenant_id,
          u.email,
          u.display_name,
          u.status,
          t.name,
          pc.password_hash,
          s.session_id,
          s.status,
          s.expires_at
      `,
      [tokenHash],
    );

    const identity = mapIdentity(result.rows[0]);
    if (!identity) {
      return null;
    }

    return {
      user: identity.user,
      tenant: identity.tenant,
      session: {
        sessionId: result.rows[0].session_id,
        tenantId: identity.user.tenantId,
        userId: identity.user.userId,
        status: result.rows[0].session_status,
        expiresAt: result.rows[0].session_expires_at.toISOString(),
      },
    };
  }

  async function createSession(user, tokenHash, expiresAt) {
    const result = await queryForTenant(
      user.tenantId,
      `
        INSERT INTO auth_sessions (tenant_id, user_id, session_token_hash, status, expires_at)
        VALUES ($1, $2, $3, 'active', $4)
        RETURNING session_id, tenant_id, user_id, status, expires_at
      `,
      [user.tenantId, user.userId, tokenHash, expiresAt],
    );

    return {
      sessionId: result.rows[0].session_id,
      tenantId: result.rows[0].tenant_id,
      userId: result.rows[0].user_id,
      status: result.rows[0].status,
      expiresAt: result.rows[0].expires_at.toISOString(),
    };
  }

  async function issueSession(user, tenant) {
    const sessionToken = createScopedToken(user.tenantId);
    const sessionTokenHash = hashSessionToken(sessionToken);
    const expiresAt = addHours(new Date(), sessionExpiryHours).toISOString();
    const session = await createSession(user, sessionTokenHash, expiresAt);

    return {
      sessionToken,
      expiresAt: session.expiresAt,
      user: {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        roles: user.roles,
        capabilities: user.capabilities,
      },
      tenant,
    };
  }

  async function createMfaChallenge({ tenantId, userId, factorId = null, purpose }) {
    const challengeToken = createScopedToken(tenantId);
    const challengeTokenHash = hashSessionToken(challengeToken);
    const expiresAt = new Date(Date.now() + MFA_CHALLENGE_EXPIRY_MINUTES * 60 * 1000).toISOString();

    await queryForTenant(
      tenantId,
      `
        INSERT INTO auth_mfa_challenges (tenant_id, user_id, factor_id, purpose, challenge_token_hash, status, expires_at)
        VALUES ($1, $2, $3, $4, $5, 'pending', $6)
      `,
      [tenantId, userId, factorId, purpose, challengeTokenHash, expiresAt],
    );

    return { challengeToken, expiresAt };
  }

  async function findMfaChallenge(challengeToken, allowedPurposes) {
    const tenantId = extractTenantIdFromScopedToken(challengeToken);
    const result = await queryForTenant(
      tenantId,
      `
        SELECT
          ch.challenge_id,
          ch.tenant_id,
          ch.user_id,
          ch.factor_id,
          ch.purpose,
          ch.expires_at,
          u.email,
          u.display_name,
          u.status,
          t.name AS company_name,
          COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles,
          COALESCE(array_agg(DISTINCT c.code) FILTER (WHERE c.code IS NOT NULL), '{}') AS capabilities
        FROM auth_mfa_challenges ch
        JOIN users u ON u.tenant_id = ch.tenant_id AND u.user_id = ch.user_id
        JOIN tenants t ON t.tenant_id = ch.tenant_id
        LEFT JOIN user_roles ur ON ur.tenant_id = u.tenant_id AND ur.user_id = u.user_id
        LEFT JOIN roles r ON r.tenant_id = u.tenant_id AND r.role_id = ur.role_id
        LEFT JOIN role_capabilities rc ON rc.role_id = r.role_id
        LEFT JOIN capabilities c ON c.capability_id = rc.capability_id
        WHERE ch.challenge_token_hash = $1
          AND ch.status = 'pending'
          AND ch.expires_at > now()
          AND ch.purpose = ANY($2::text[])
        GROUP BY ch.challenge_id, ch.tenant_id, ch.user_id, ch.factor_id, ch.purpose, ch.expires_at, u.email, u.display_name, u.status, t.name
      `,
      [hashSessionToken(challengeToken), allowedPurposes],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      challengeId: row.challenge_id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      factorId: row.factor_id,
      purpose: row.purpose,
      expiresAt: row.expires_at.toISOString(),
      user: {
        userId: row.user_id,
        tenantId: row.tenant_id,
        email: row.email,
        displayName: row.display_name,
        status: row.status,
        roles: Array.isArray(row.roles) ? row.roles.filter(Boolean) : [],
        capabilities: Array.isArray(row.capabilities) ? row.capabilities.filter(Boolean) : [],
      },
      tenant: {
        tenantId: row.tenant_id,
        companyName: row.company_name,
      },
    };
  }

  async function markMfaChallengeUsed(tenantId, challengeId) {
    await queryForTenant(
      tenantId,
      `
        UPDATE auth_mfa_challenges
        SET status = 'used', used_at = now()
        WHERE challenge_id = $1
      `,
      [challengeId],
    );
  }

  async function login({ tenantId, email, password }) {
    const normalizedEmail = normalizeEmail(email);
    let resolvedTenantId;
    try {
      resolvedTenantId = await resolveTenantIdentifier(tenantId);
    } catch (error) {
      return { status: error.status || 401, body: { code: error.code || "INVALID_CREDENTIALS", message: "Credenciales invalidas." } };
    }

    const failedPressure = await getFailedLoginPressure(resolvedTenantId, normalizedEmail);
    if (failedPressure >= failedLoginLimit) {
      await recordLoginAttempt({ tenantId: resolvedTenantId, email: normalizedEmail, succeeded: false, reason: "rate_limited" });
      return {
        status: 429,
        body: {
          code: "RATE_LIMITED",
          message: "Demasiados intentos fallidos. Espera unos minutos antes de volver a intentarlo.",
        },
      };
    }

    const identity = await findIdentityByEmail(resolvedTenantId, normalizedEmail);

    if (!identity || !identity.passwordHash) {
      await recordLoginAttempt({ tenantId: resolvedTenantId, email: normalizedEmail, succeeded: false, reason: "not_found" });
      return { status: 401, body: { code: "INVALID_CREDENTIALS", message: "Credenciales invalidas." } };
    }

    if (identity.user.status !== "active") {
      await recordLoginAttempt({ tenantId: resolvedTenantId, email: normalizedEmail, succeeded: false, reason: "suspended" });
      return { status: 403, body: { code: "ACCOUNT_NOT_ACTIVE", message: "La cuenta no esta activa." } };
    }

    const passwordValid = await verifyPassword(password, identity.passwordHash);
    if (!passwordValid) {
      await recordLoginAttempt({ tenantId: resolvedTenantId, email: normalizedEmail, succeeded: false, reason: "bad_password" });
      return { status: 401, body: { code: "INVALID_CREDENTIALS", message: "Credenciales invalidas." } };
    }

    const licenseCheck = await checkTenantLicenseForLogin(identity.user);
    if (licenseCheck) {
      await recordLoginAttempt({ tenantId: resolvedTenantId, email: normalizedEmail, succeeded: false, reason: licenseCheck.body.code });
      return licenseCheck;
    }

    const privilegedAccessRequiresMfa = identity.user.roles.some((role) => role === "admin" || role === "super_admin");

    if (requireAdminMfa && privilegedAccessRequiresMfa && !identity.hasEnabledMfa) {
      const setupChallenge = await createMfaChallenge({
        tenantId: identity.user.tenantId,
        userId: identity.user.userId,
        purpose: "setup_totp",
      });
      await recordLoginAttempt({ tenantId: resolvedTenantId, email: normalizedEmail, succeeded: false, reason: "mfa_required" });
      return {
        status: 202,
        body: {
          code: "MFA_SETUP_REQUIRED",
          message: "El acceso administrativo debe activar autenticacion de dos factores antes de iniciar sesion.",
          mfaSetupToken: setupChallenge.challengeToken,
          expiresAt: setupChallenge.expiresAt,
        },
      };
    }

    if (requireAdminMfa && privilegedAccessRequiresMfa && identity.hasEnabledMfa) {
      const factor = await queryForTenant(
        identity.user.tenantId,
        `
          SELECT factor_id
          FROM auth_mfa_factors
          WHERE tenant_id = $1
            AND user_id = $2
            AND factor_type = 'totp'
            AND status = 'enabled'
          ORDER BY verified_at DESC NULLS LAST, created_at DESC
          LIMIT 1
        `,
        [identity.user.tenantId, identity.user.userId],
      );
      const challenge = await createMfaChallenge({
        tenantId: identity.user.tenantId,
        userId: identity.user.userId,
        factorId: factor.rows[0].factor_id,
        purpose: "login_totp",
      });
      await recordLoginAttempt({ tenantId: resolvedTenantId, email: normalizedEmail, succeeded: false, reason: "mfa_required" });
      return {
        status: 202,
        body: {
          code: "MFA_REQUIRED",
          message: "Se requiere codigo de autenticacion de dos factores.",
          mfaChallengeToken: challenge.challengeToken,
          expiresAt: challenge.expiresAt,
        },
      };
    }

    await recordLoginAttempt({ tenantId: resolvedTenantId, email: normalizedEmail, succeeded: true, reason: "ok" });

    return {
      status: 200,
      body: await issueSession(identity.user, identity.tenant),
    };
  }

  async function setupTotp({ mfaSetupToken, label = "Authenticator app" }) {
    const challenge = await findMfaChallenge(mfaSetupToken, ["setup_totp"]);
    if (!challenge) {
      return { status: 401, body: { code: "MFA_CHALLENGE_INVALID", message: "El reto de MFA no es valido o expiro." } };
    }

    const secret = generateTotpSecret();
    const encrypted = encryptSecret(secret);
    const result = await queryForTenant(
      challenge.tenantId,
      `
        INSERT INTO auth_mfa_factors (
          tenant_id,
          user_id,
          factor_type,
          label,
          secret_ciphertext,
          secret_iv,
          secret_tag,
          status
        )
        VALUES ($1, $2, 'totp', $3, $4, $5, $6, 'pending')
        RETURNING factor_id
      `,
      [
        challenge.tenantId,
        challenge.userId,
        String(label || "Authenticator app").slice(0, 80),
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.tag,
      ],
    );

    return {
      status: 200,
      body: {
        factorId: result.rows[0].factor_id,
        secret,
        otpauthUri: createTotpAuthUri({
          issuer,
          accountName: challenge.user.email,
          secret,
        }),
      },
    };
  }

  async function verifyTotp({ mfaChallengeToken, mfaSetupToken, factorId, code }) {
    const challengeToken = mfaChallengeToken || mfaSetupToken;
    const challenge = await findMfaChallenge(challengeToken, ["setup_totp", "login_totp"]);
    if (!challenge) {
      return { status: 401, body: { code: "MFA_CHALLENGE_INVALID", message: "El reto de MFA no es valido o expiro." } };
    }

    const resolvedFactorId = factorId || challenge.factorId;
    const factor = await queryForTenant(
      challenge.tenantId,
      `
        SELECT factor_id, secret_ciphertext, secret_iv, secret_tag, status
        FROM auth_mfa_factors
        WHERE tenant_id = $1
          AND user_id = $2
          AND factor_id = $3
          AND factor_type = 'totp'
          AND status IN ('pending', 'enabled')
      `,
      [challenge.tenantId, challenge.userId, resolvedFactorId],
    );

    if (!factor.rows[0]) {
      return { status: 404, body: { code: "MFA_FACTOR_NOT_FOUND", message: "Factor MFA no encontrado." } };
    }

    let secret;
    try {
      secret = decryptSecret({
        ciphertext: factor.rows[0].secret_ciphertext,
        iv: factor.rows[0].secret_iv,
        tag: factor.rows[0].secret_tag,
      });
    } catch (error) {
      const unreadableSecret = new Error("El segundo factor no se puede validar con la clave de cifrado actual. Restablece MFA para este usuario.");
      unreadableSecret.status = 409;
      unreadableSecret.code = "MFA_SECRET_UNREADABLE";
      throw unreadableSecret;
    }

    if (!verifyTotpCode({ secret, code })) {
      return { status: 401, body: { code: "MFA_CODE_INVALID", message: "Codigo MFA invalido." } };
    }

    await queryForTenant(
      challenge.tenantId,
      `
        UPDATE auth_mfa_factors
        SET status = 'enabled', verified_at = COALESCE(verified_at, now()), last_used_at = now(), updated_at = now()
        WHERE factor_id = $1
      `,
      [factor.rows[0].factor_id],
    );
    await markMfaChallengeUsed(challenge.tenantId, challenge.challengeId);
    await ensureTenantLicenseAllowsAccess(challenge.user);
    await recordLoginAttempt({ tenantId: challenge.tenantId, email: challenge.user.email, succeeded: true, reason: "ok" });

    return {
      status: 200,
      body: await issueSession(challenge.user, challenge.tenant),
    };
  }

  async function resolveSession(authorizationHeader) {
    const token = String(authorizationHeader || "").replace(/^Bearer\s+/iu, "").trim();
    if (!token) {
      return null;
    }

    const resolved = await findSessionByTokenHash(hashSessionToken(token), extractTenantIdFromScopedToken(token));
    if (resolved) {
      await ensureTenantLicenseAllowsAccess(resolved.user);
    }
    return resolved;
  }

  async function revokeSession(authorizationHeader) {
    const token = String(authorizationHeader || "").replace(/^Bearer\s+/iu, "").trim();
    if (!token) {
      return false;
    }

    const tenantId = extractTenantIdFromScopedToken(token);
    const result = await queryForTenant(
      tenantId,
      `
        UPDATE auth_sessions
        SET status = 'revoked', revoked_at = now()
        WHERE session_token_hash = $1
          AND status = 'active'
      `,
      [hashSessionToken(token)],
    );

    return result.rowCount > 0;
  }

  async function queryForTenant(tenantId, sql, params = []) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      const result = await client.query(sql, params);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function checkTenantLicenseForLogin(user) {
    try {
      await ensureTenantLicenseAllowsAccess(user);
      return null;
    } catch (error) {
      return {
        status: error.status || 403,
        body: {
          code: error.code || "LICENSE_BLOCKED",
          message: error.message || "La licencia de la empresa no permite iniciar sesion.",
        },
      };
    }
  }

  async function ensureTenantLicenseAllowsAccess(user) {
    if ((user.roles || []).includes("super_admin")) {
      return;
    }

    const result = await queryForTenant(
      user.tenantId,
      `
        SELECT status, expires_at
        FROM tenant_licenses
        WHERE tenant_id = $1
        LIMIT 1
      `,
      [user.tenantId],
    );
    const license = result.rows[0];
    if (!license) {
      throw licenseError(403, "LICENSE_REQUIRED", "La empresa no tiene una licencia activa asignada. Contacta al proveedor del software.");
    }

    if (license.status === "suspended" || license.status === "revoked") {
      throw licenseError(403, "LICENSE_SUSPENDED", "La licencia de esta empresa esta suspendida. Contacta al proveedor del software.");
    }

    if (license.status === "past_due") {
      throw licenseError(402, "LICENSE_PAST_DUE", "La licencia de esta empresa tiene pagos pendientes. Contacta al proveedor del software.");
    }

    if (license.status === "expired" || new Date(license.expires_at).getTime() <= Date.now()) {
      throw licenseError(403, "LICENSE_EXPIRED", "La licencia de esta empresa vencio. Contacta al proveedor del software.");
    }
  }

  return {
    login,
    setupTotp,
    verifyTotp,
    resolveSession,
    revokeSession,
  };
}

function licenseError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeTenantSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function createScopedToken(tenantId) {
  return `${tenantId}.${generateSessionToken()}`;
}

function extractTenantIdFromScopedToken(token) {
  const [tenantId] = String(token || "").split(".", 1);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(tenantId)) {
    const error = new Error("Session is invalid or expired.");
    error.status = 401;
    error.code = "AUTH_REQUIRED";
    throw error;
  }

  return tenantId;
}

export function createRequestContextFromResolvedSession(requestId, resolved) {
  if (!resolved || resolved.user.status !== "active" || resolved.user.roles.length === 0) {
    const error = new Error("Session is invalid or expired.");
    error.status = 401;
    error.code = "AUTH_REQUIRED";
    throw error;
  }

  return {
    requestId,
    tenant: resolved.tenant,
    actor: {
      userId: resolved.user.userId,
      email: resolved.user.email,
      displayName: resolved.user.displayName,
      role: resolved.user.roles[0],
      roles: resolved.user.roles,
      capabilities: resolved.user.capabilities,
    },
    session: {
      expiresAt: resolved.session.expiresAt,
    },
  };
}

export function createPostgresSessionContextResolver(repository) {
  return {
    async resolve(input) {
      const resolved = await repository.resolveSession(input.authorizationHeader);
      if (!resolved) {
        const error = new Error("Session is invalid or expired.");
        error.status = 401;
        error.code = "AUTH_REQUIRED";
        throw error;
      }

      return createRequestContextFromResolvedSession(input.requestId, resolved);
    },
  };
}
