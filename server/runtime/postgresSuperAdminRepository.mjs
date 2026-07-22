import { randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { createPostgresPoolFromEnv } from "./postgresAuthRepository.mjs";

const PROVIDER_TENANT_ID = "00000000-0000-4000-8000-000000000001";
const LICENSE_STATUSES = new Set(["trial", "active", "past_due", "suspended", "expired", "revoked"]);
const DURATION_PRESETS = new Set(["trial_7d", "trial_30d", "one_year", "two_years", "manual"]);
const PLAN_CODES = new Set(["starter", "growth", "dedicated"]);
const INDUSTRY_PROFILES = new Set(["construction", "cleaning"]);
const CURRENCIES = new Set(["USD", "COP", "EUR"]);

export function createPostgresSuperAdminRepositoryFromEnv(env = process.env) {
  const connectionString = env.SUPER_ADMIN_DATABASE_URL || env.ADMIN_DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  const pool = createPostgresPoolFromEnv({
    ...env,
    DATABASE_URL: connectionString,
  });

  if (!pool) {
    return null;
  }

  return {
    ...createPostgresSuperAdminRepository(pool),
    async close() {
      await pool.end();
    },
  };
}

export function createPostgresSuperAdminRepository(pool) {
  async function createTenant(context, input = {}) {
    requireSuperAdmin(context, "superadmin.manage");
    const clean = normalizeTenantInput(input);
    const tenantId = randomUUID();
    const adminUserId = randomUUID();
    const temporaryPassword = clean.adminPassword || generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const license = normalizeLicenseInput({
      durationPreset: clean.durationPreset,
      status: clean.status,
      planCode: clean.planCode,
      seatsLimit: clean.seatsLimit,
      storageQuotaMb: clean.storageQuotaMb,
      features: clean.features,
      notes: clean.notes,
    });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      await client.query(
        `
          INSERT INTO tenants (tenant_id, name, industry_profile, locale, currency, timezone)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [tenantId, clean.companyName, clean.industryProfile, clean.locale, clean.currency, clean.timezone],
      );
      await ensureTenantRolesAndCapabilities(client, tenantId);
      await client.query(
        `
          INSERT INTO users (user_id, tenant_id, email, display_name, status)
          VALUES ($1, $2, $3, $4, 'active')
        `,
        [adminUserId, tenantId, clean.adminEmail, clean.adminName],
      );
      await client.query(
        `
          INSERT INTO user_roles (tenant_id, user_id, role_id)
          SELECT $1, $2, role_id
          FROM roles
          WHERE tenant_id = $1 AND code = 'admin'
        `,
        [tenantId, adminUserId],
      );
      await client.query(
        `
          INSERT INTO auth_password_credentials (tenant_id, user_id, password_hash, password_algorithm)
          VALUES ($1, $2, $3, 'argon2id')
        `,
        [tenantId, adminUserId, passwordHash],
      );
      const licenseResult = await client.query(
        `
          INSERT INTO tenant_licenses (
            tenant_id,
            license_code,
            status,
            plan_code,
            starts_at,
            expires_at,
            trial_ends_at,
            duration_preset,
            seats_limit,
            storage_quota_mb,
            features,
            notes,
            created_by_user_id,
            updated_by_user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $13)
          RETURNING license_id, tenant_id, license_code, status, plan_code, starts_at, expires_at,
                    trial_ends_at, duration_preset, seats_limit, storage_quota_mb, features, notes, updated_at
        `,
        [
          tenantId,
          `LIC-${tenantId.replace(/-/g, "").slice(0, 12).toUpperCase()}`,
          license.status,
          license.planCode,
          license.startsAt,
          license.expiresAt,
          license.trialEndsAt,
          license.durationPreset,
          license.seatsLimit,
          license.storageQuotaMb,
          JSON.stringify(license.features),
          license.notes,
          context.actor.userId,
        ],
      );
      await syncTenantUsageLimitsFromLicense(client, tenantId, license, context.actor.userId);
      await client.query(
        `
          INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
          VALUES ($1, $2, 'tenant.initial_admin_created', 'auth', 'user', $2, 'info', $3::jsonb)
        `,
        [
          tenantId,
          adminUserId,
          JSON.stringify({
            source: "super-admin",
            passwordStored: "argon2id-hash-only",
            mfaRequired: true,
          }),
        ],
      );
      await client.query("COMMIT");

      await writeSuperAdminAudit(context, {
        action: "super_admin.tenant.created",
        targetTenantId: tenantId,
        entityType: "tenant",
        entityId: tenantId,
        severity: "warning",
        metadata: {
          companyName: clean.companyName,
          adminEmail: clean.adminEmail,
          durationPreset: license.durationPreset,
          planCode: license.planCode,
        },
      });

      return {
        tenant: {
          tenantId,
          companyName: clean.companyName,
          industryProfile: clean.industryProfile,
          locale: clean.locale,
          currency: clean.currency,
          timezone: clean.timezone,
        },
        license: mapLicense(licenseResult.rows[0]),
        initialAdmin: {
          userId: adminUserId,
          email: clean.adminEmail,
          displayName: clean.adminName,
          temporaryPassword,
          mustSetupMfa: true,
        },
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async function listTenants(context) {
    requireSuperAdmin(context, "superadmin.read");
    const result = await pool.query(
      `
        SELECT
          t.tenant_id,
          t.name,
          t.industry_profile,
          t.locale,
          t.currency,
          t.timezone,
          t.created_at,
          t.updated_at,
          l.license_id,
          l.license_code,
          l.status AS license_status,
          l.plan_code,
          l.starts_at,
          l.expires_at,
          l.trial_ends_at,
          l.duration_preset,
          l.seats_limit,
          l.storage_quota_mb,
          l.features,
          l.notes,
          l.updated_at AS license_updated_at,
          COALESCE((SELECT count(*)::int FROM users u WHERE u.tenant_id = t.tenant_id), 0) AS user_count,
          COALESCE((SELECT count(*)::int FROM documents d WHERE d.tenant_id = t.tenant_id), 0) AS document_count,
          COALESCE((SELECT sum(d.storage_size_bytes)::bigint FROM documents d WHERE d.tenant_id = t.tenant_id), 0) AS storage_size_bytes,
          (SELECT max(a.created_at) FROM audit_events a WHERE a.tenant_id = t.tenant_id) AS last_activity_at
        FROM tenants t
        LEFT JOIN tenant_licenses l ON l.tenant_id = t.tenant_id
        WHERE t.tenant_id <> $1
          AND t.archived_at IS NULL
        ORDER BY t.created_at DESC
        LIMIT 300
      `,
      [PROVIDER_TENANT_ID],
    );

    const items = result.rows.map(mapTenantLicenseRow);
    return {
      items,
      total: items.length,
      summary: summarizeTenants(items),
    };
  }

  async function upsertTenantLicense(context, tenantId, input = {}) {
    requireSuperAdmin(context, "superadmin.manage");
    assertUuid(tenantId, "Tenant no valido.");
    const tenant = await requireClientTenant(tenantId);
    const clean = normalizeLicenseInput(input);

    const client = await pool.connect();
    let result;
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      result = await client.query(
        `
          INSERT INTO tenant_licenses (
            tenant_id,
            license_code,
            status,
            plan_code,
            starts_at,
            expires_at,
            trial_ends_at,
            duration_preset,
            seats_limit,
            storage_quota_mb,
            features,
            notes,
            created_by_user_id,
            updated_by_user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $13)
          ON CONFLICT (tenant_id) DO UPDATE
          SET status = EXCLUDED.status,
              plan_code = EXCLUDED.plan_code,
              starts_at = EXCLUDED.starts_at,
              expires_at = EXCLUDED.expires_at,
              trial_ends_at = EXCLUDED.trial_ends_at,
              duration_preset = EXCLUDED.duration_preset,
              seats_limit = EXCLUDED.seats_limit,
              storage_quota_mb = EXCLUDED.storage_quota_mb,
              features = EXCLUDED.features,
              notes = EXCLUDED.notes,
              updated_by_user_id = EXCLUDED.updated_by_user_id,
              updated_at = now()
          RETURNING license_id, tenant_id, license_code, status, plan_code, starts_at, expires_at,
                    trial_ends_at, duration_preset, seats_limit, storage_quota_mb, features, notes, updated_at
        `,
        [
          tenantId,
          clean.licenseCode || `LIC-${randomUUID().replace(/-/gu, "").slice(0, 12).toUpperCase()}`,
          clean.status,
          clean.planCode,
          clean.startsAt,
          clean.expiresAt,
          clean.trialEndsAt,
          clean.durationPreset,
          clean.seatsLimit,
          clean.storageQuotaMb,
          JSON.stringify(clean.features),
          clean.notes,
          context.actor.userId,
        ],
      );
      await syncTenantUsageLimitsFromLicense(client, tenantId, clean, context.actor.userId);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => null);
      throw error;
    } finally {
      client.release();
    }

    await writeSuperAdminAudit(context, {
      action: "super_admin.license.upserted",
      targetTenantId: tenantId,
      entityType: "tenant_license",
      entityId: result.rows[0].license_id,
      metadata: {
        status: clean.status,
        planCode: clean.planCode,
        durationPreset: clean.durationPreset,
        expiresAt: clean.expiresAt,
      },
    });

    return {
      tenant,
      license: mapLicense(result.rows[0]),
    };
  }

  async function requireClientTenant(tenantId) {
    const result = await pool.query(
      `
        SELECT tenant_id, name, industry_profile, locale, currency, timezone, created_at, updated_at
        FROM tenants
        WHERE tenant_id = $1
          AND tenant_id <> $2
          AND archived_at IS NULL
      `,
      [tenantId, PROVIDER_TENANT_ID],
    );

    if (!result.rows[0]) {
      throw createHttpError(404, "TENANT_NOT_FOUND", "Empresa cliente no encontrada.");
    }

    return mapTenant(result.rows[0]);
  }

  async function writeSuperAdminAudit(context, event) {
    await pool.query(
      `
        INSERT INTO super_admin_audit_events (
          actor_user_id,
          actor_email,
          action,
          target_tenant_id,
          entity_type,
          entity_id,
          severity,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `,
      [
        context.actor.userId,
        context.actor.email || null,
        event.action,
        event.targetTenantId,
        event.entityType,
        event.entityId,
        event.severity || "info",
        JSON.stringify(event.metadata || {}),
      ],
    );
  }

  return {
    createTenant,
    listTenants,
    upsertTenantLicense,
  };
}

async function syncTenantUsageLimitsFromLicense(client, tenantId, license, actorUserId) {
  const features = license.features || {};
  await client.query(
    `
      INSERT INTO tenant_usage_limits (
        tenant_id,
        plan_code,
        storage_quota_mb,
        photo_evidence_enabled,
        marketing_addon_enabled,
        dedicated_storage_enabled,
        updated_by_user_id,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      ON CONFLICT (tenant_id) DO UPDATE
      SET plan_code = EXCLUDED.plan_code,
          storage_quota_mb = EXCLUDED.storage_quota_mb,
          photo_evidence_enabled = EXCLUDED.photo_evidence_enabled,
          marketing_addon_enabled = EXCLUDED.marketing_addon_enabled,
          dedicated_storage_enabled = EXCLUDED.dedicated_storage_enabled,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = now(),
          metadata = tenant_usage_limits.metadata || EXCLUDED.metadata
    `,
    [
      tenantId,
      license.planCode,
      license.storageQuotaMb,
      Boolean(features.photoEvidenceAddon),
      Boolean(features.marketingAddon),
      license.planCode === "dedicated" || Boolean(features.dedicatedStorage),
      actorUserId,
      JSON.stringify({ source: "super-admin-license", syncedAt: new Date().toISOString() }),
    ],
  );
}

async function ensureTenantRolesAndCapabilities(client, tenantId) {
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

  await client.query(
    `
      INSERT INTO role_capabilities (role_id, capability_id)
      SELECT r.role_id, c.capability_id
      FROM roles r
      CROSS JOIN capabilities c
      WHERE r.tenant_id = $1
        AND r.code = 'admin'
        AND c.code NOT LIKE 'superadmin.%'
      ON CONFLICT (role_id, capability_id) DO NOTHING
    `,
    [tenantId],
  );

  await client.query(
    `
      INSERT INTO role_capabilities (role_id, capability_id)
      SELECT r.role_id, c.capability_id
      FROM roles r
      CROSS JOIN capabilities c
      WHERE r.tenant_id = $1
        AND r.code = 'manager'
        AND c.code = ANY($2::text[])
      ON CONFLICT (role_id, capability_id) DO NOTHING
    `,
    [
      tenantId,
      [
        "clients.read",
        "clients.update",
        "estimates.read",
        "estimates.create",
        "estimates.update",
        "jobs.read",
        "jobs.update",
        "workforce.read",
        "attendance.read",
        "attendance.review.visual",
        "notifications.read",
        "reports.read",
      ],
    ],
  );

  await client.query(
    `
      INSERT INTO role_capabilities (role_id, capability_id)
      SELECT r.role_id, c.capability_id
      FROM roles r
      CROSS JOIN capabilities c
      WHERE r.tenant_id = $1
        AND r.code = 'worker'
        AND c.code = ANY($2::text[])
      ON CONFLICT (role_id, capability_id) DO NOTHING
    `,
    [tenantId, ["worker.tasks.read", "worker.tasks.update", "attendance.self.visual", "notifications.read", "proofs.self.visual"]],
  );
}

function requireSuperAdmin(context, capability) {
  const roles = context?.actor?.roles || [];
  const capabilities = context?.actor?.capabilities || [];
  if (!roles.includes("super_admin") || !capabilities.includes(capability)) {
    throw createHttpError(403, "FORBIDDEN", "Solo Super Admin puede usar esta consola.");
  }
}

function normalizeLicenseInput(input) {
  const durationPreset = validateEnum(input.durationPreset || "manual", DURATION_PRESETS, "Duracion de licencia no soportada.");
  const startsAt = parseDateTime(input.startsAt) || new Date();
  const computed = computeLicenseDates(durationPreset, startsAt, input.expiresAt);
  const status = validateEnum(input.status || computed.status, LICENSE_STATUSES, "Estado de licencia no soportado.");
  const planCode = validateEnum(input.planCode || "starter", PLAN_CODES, "Plan no soportado.");

  return {
    licenseCode: optionalText(input.licenseCode, 80),
    status,
    planCode,
    startsAt: startsAt.toISOString(),
    expiresAt: computed.expiresAt.toISOString(),
    trialEndsAt: computed.trialEndsAt ? computed.trialEndsAt.toISOString() : null,
    durationPreset,
    seatsLimit: positiveInt(input.seatsLimit, 5, 500, "Limite de usuarios no valido."),
    storageQuotaMb: positiveInt(input.storageQuotaMb, 500, 1024 * 1024, "Limite de almacenamiento no valido."),
    features: typeof input.features === "object" && input.features !== null && !Array.isArray(input.features) ? input.features : {},
    notes: optionalText(input.notes, 1500),
  };
}

function normalizeTenantInput(input) {
  const currency = validateEnum(input.currency || "USD", CURRENCIES, "Moneda no soportada.");
  const defaults = currency === "COP"
    ? { locale: "es-CO", timezone: "America/Bogota" }
    : currency === "EUR"
      ? { locale: "es-ES", timezone: "Europe/Madrid" }
      : { locale: "en-US", timezone: "America/Denver" };
  const adminPassword = optionalText(input.adminPassword, 160);
  if (adminPassword && adminPassword.length < 14) {
    throw createHttpError(400, "VALIDATION_ERROR", "La contrasena temporal debe tener al menos 14 caracteres.");
  }

  return {
    companyName: requiredText(input.companyName, 180, "Nombre de empresa requerido."),
    industryProfile: validateEnum(input.industryProfile || "construction", INDUSTRY_PROFILES, "Perfil de industria no soportado."),
    locale: optionalText(input.locale, 20) || defaults.locale,
    currency,
    timezone: optionalText(input.timezone, 80) || defaults.timezone,
    adminEmail: normalizeEmail(input.adminEmail),
    adminName: requiredText(input.adminName || "Administrador", 160, "Nombre del administrador requerido."),
    adminPassword,
    durationPreset: validateEnum(input.durationPreset || "trial_30d", DURATION_PRESETS, "Duracion de licencia no soportada."),
    status: validateEnum(input.status || "trial", LICENSE_STATUSES, "Estado de licencia no soportado."),
    planCode: validateEnum(input.planCode || "starter", PLAN_CODES, "Plan no soportado."),
    seatsLimit: positiveInt(input.seatsLimit, 5, 500, "Limite de usuarios no valido."),
    storageQuotaMb: positiveInt(input.storageQuotaMb, 500, 1024 * 1024, "Limite de almacenamiento no valido."),
    features: typeof input.features === "object" && input.features !== null && !Array.isArray(input.features) ? input.features : {},
    notes: optionalText(input.notes, 1500),
  };
}

function computeLicenseDates(durationPreset, startsAt, manualExpiresAt) {
  const expiresAt = new Date(startsAt);
  if (durationPreset === "trial_7d") {
    expiresAt.setDate(expiresAt.getDate() + 7);
    return { status: "trial", expiresAt, trialEndsAt: expiresAt };
  }
  if (durationPreset === "trial_30d") {
    expiresAt.setDate(expiresAt.getDate() + 30);
    return { status: "trial", expiresAt, trialEndsAt: expiresAt };
  }
  if (durationPreset === "one_year") {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    return { status: "active", expiresAt, trialEndsAt: null };
  }
  if (durationPreset === "two_years") {
    expiresAt.setFullYear(expiresAt.getFullYear() + 2);
    return { status: "active", expiresAt, trialEndsAt: null };
  }

  const manual = parseDateTime(manualExpiresAt);
  if (!manual || manual <= startsAt) {
    throw createHttpError(400, "VALIDATION_ERROR", "La licencia manual necesita una fecha de vencimiento posterior al inicio.");
  }
  return { status: "active", expiresAt: manual, trialEndsAt: null };
}

function mapTenantLicenseRow(row) {
  return {
    ...mapTenant(row),
    license: row.license_id ? mapLicense(row) : null,
    usage: {
      userCount: Number(row.user_count || 0),
      documentCount: Number(row.document_count || 0),
      storageSizeBytes: Number(row.storage_size_bytes || 0),
      lastActivityAt: row.last_activity_at ? row.last_activity_at.toISOString() : null,
    },
  };
}

function mapTenant(row) {
  return {
    tenantId: row.tenant_id,
    companyName: row.name,
    industryProfile: row.industry_profile,
    locale: row.locale,
    currency: row.currency,
    timezone: row.timezone,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function mapLicense(row) {
  return {
    licenseId: row.license_id,
    tenantId: row.tenant_id,
    licenseCode: row.license_code,
    status: row.license_status || row.status,
    planCode: row.plan_code,
    startsAt: row.starts_at?.toISOString?.() || row.starts_at,
    expiresAt: row.expires_at?.toISOString?.() || row.expires_at,
    trialEndsAt: row.trial_ends_at ? row.trial_ends_at.toISOString() : null,
    durationPreset: row.duration_preset,
    seatsLimit: Number(row.seats_limit),
    storageQuotaMb: Number(row.storage_quota_mb),
    features: row.features || {},
    notes: row.notes || "",
    updatedAt: row.license_updated_at?.toISOString?.() || row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function summarizeTenants(items) {
  return items.reduce(
    (summary, tenant) => {
      summary.total += 1;
      const status = tenant.license?.status || "missing";
      summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
      summary.userCount += tenant.usage.userCount;
      summary.storageSizeBytes += tenant.usage.storageSizeBytes;
      if (["suspended", "revoked", "expired", "past_due", "missing"].includes(status)) {
        summary.blocked += 1;
      }
      if (tenant.license?.expiresAt) {
        const expiresAt = new Date(tenant.license.expiresAt).getTime();
        const daysToExpire = Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
        if (daysToExpire >= 0 && daysToExpire <= 14) {
          summary.expiringSoon += 1;
        }
      }
      if (tenant.license?.storageQuotaMb && tenant.usage.storageSizeBytes > tenant.license.storageQuotaMb * 1024 * 1024) {
        summary.storageOverQuota += 1;
      }
      return summary;
    },
    { total: 0, byStatus: {}, userCount: 0, storageSizeBytes: 0, blocked: 0, expiringSoon: 0, storageOverQuota: 0 },
  );
}

function assertUuid(value, message) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(String(value || ""))) {
    throw createHttpError(400, "VALIDATION_ERROR", message);
  }
}

function validateEnum(value, allowed, message) {
  const normalized = String(value || "").trim();
  if (!allowed.has(normalized)) {
    throw createHttpError(400, "VALIDATION_ERROR", message);
  }
  return normalized;
}

function positiveInt(value, fallback, max, message) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number <= 0 || number > max) {
    throw createHttpError(400, "VALIDATION_ERROR", message);
  }
  return number;
}

function requiredText(value, maxLength, message) {
  const text = String(value || "").trim();
  if (!text || text.length > maxLength) {
    throw createHttpError(400, "VALIDATION_ERROR", message);
  }
  return text;
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw createHttpError(400, "VALIDATION_ERROR", "Correo del administrador no valido.");
  }
  return email;
}

function optionalText(value, maxLength) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function generateTemporaryPassword() {
  return randomBytes(18).toString("base64url");
}

async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

function parseDateTime(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function createHttpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}
