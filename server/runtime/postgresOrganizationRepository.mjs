import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { createEmailMetadata, resolveEmailDeliveryConfig } from "./emailDeliveryRuntime.mjs";
import { createPostgresPoolFromEnv } from "./postgresAuthRepository.mjs";

const COUNTRIES = new Set(["US", "CO", "ES"]);
const CURRENCIES = new Set(["USD", "COP", "EUR"]);
const UNIT_SYSTEMS = new Set(["imperial", "metric"]);
const LANGUAGES = new Set(["es", "en"]);
const ESTIMATE_TEMPLATES = new Set(["estimate_classic_blue", "estimate_cleaning_teal"]);
const INVOICE_TEMPLATES = new Set(["invoice_clean_red", "invoice_compact_navy"]);
const USER_ROLES = new Set(["admin", "manager", "worker"]);
const USER_STATUSES = new Set(["active", "inactive", "suspended"]);
const PRIVACY_POLICY_VERSION = "2026-07-15";
const PLAN_CODES = new Set(["starter", "growth", "dedicated"]);

const COUNTRY_DEFAULTS = {
  US: { currency: "USD", unitSystem: "imperial", timezone: "America/Denver", locale: "en-US" },
  CO: { currency: "COP", unitSystem: "metric", timezone: "America/Bogota", locale: "es-CO" },
  ES: { currency: "EUR", unitSystem: "metric", timezone: "Europe/Madrid", locale: "es-ES" },
};

export function createPostgresOrganizationRepositoryFromEnv(env = process.env) {
  const pool = createPostgresPoolFromEnv(env);
  if (!pool) {
    return null;
  }

  return {
    ...createPostgresOrganizationRepository(pool),
    async close() {
      await pool.end();
    },
  };
}

export function createPostgresOrganizationRepository(pool) {
  async function queryForTenant(context, callback) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [context.tenant.tenantId]);
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

  async function getSettings(context) {
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          SELECT tenant_id, name, industry_profile, locale, currency, timezone,
                 country_profile, unit_system, app_language, document_language, tenant_slug,
                 legal_name, tax_id, contractor_license, company_address, company_city,
                 company_region, company_postal_code, company_country, company_phone,
                 worker_support_phone, worker_support_whatsapp_url,
                 company_email, company_website, logo_url, estimate_template_id, invoice_template_id,
                 document_company_visibility, document_signature, updated_at
          FROM tenants
          WHERE tenant_id = $1
        `,
        [context.tenant.tenantId],
      );
      return mapSettings(result.rows[0]);
    });
  }

  async function updateSettings(context, input) {
    const current = await getSettings(context);
    const clean = validateSettings({ ...current, ...input });
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          UPDATE tenants
          SET name = $2,
              locale = $3,
              currency = $4,
              timezone = $5,
              country_profile = $6,
              unit_system = $7,
              app_language = $8,
              document_language = $9,
              tenant_slug = $10,
              legal_name = $11,
              tax_id = $12,
              contractor_license = $13,
              company_address = $14,
              company_city = $15,
              company_region = $16,
              company_postal_code = $17,
              company_country = $18,
              company_phone = $19,
              worker_support_phone = $20,
              worker_support_whatsapp_url = $21,
              company_email = $22,
              company_website = $23,
              logo_url = $24,
              estimate_template_id = $25,
              invoice_template_id = $26,
              document_company_visibility = $27::jsonb,
              document_signature = $28::jsonb,
              updated_at = now()
          WHERE tenant_id = $1
          RETURNING tenant_id, name, industry_profile, locale, currency, timezone,
                    country_profile, unit_system, app_language, document_language, tenant_slug,
                    legal_name, tax_id, contractor_license, company_address, company_city,
                    company_region, company_postal_code, company_country, company_phone,
                    worker_support_phone, worker_support_whatsapp_url,
                    company_email, company_website, logo_url, estimate_template_id, invoice_template_id,
                    document_company_visibility, document_signature, updated_at
        `,
        [
          context.tenant.tenantId,
          clean.companyName,
          clean.locale,
          clean.currency,
          clean.timezone,
          clean.countryProfile,
          clean.unitSystem,
          clean.appLanguage,
          clean.documentLanguage,
          clean.tenantSlug,
          clean.legalName,
          clean.taxId,
          clean.contractorLicense,
          clean.companyAddress,
          clean.companyCity,
          clean.companyRegion,
          clean.companyPostalCode,
          clean.companyCountry,
          clean.companyPhone,
          clean.workerSupportPhone,
          clean.workerSupportWhatsappUrl,
          clean.companyEmail,
          clean.companyWebsite,
          clean.logoUrl,
          clean.estimateTemplateId,
          clean.invoiceTemplateId,
          JSON.stringify(clean.documentCompanyVisibility),
          JSON.stringify(clean.documentSignature),
        ],
      );
      await writeAudit(client, context, "organization.settings.updated", "tenant", context.tenant.tenantId, {
        countryProfile: clean.countryProfile,
        currency: clean.currency,
        unitSystem: clean.unitSystem,
        appLanguage: clean.appLanguage,
        documentLanguage: clean.documentLanguage,
      });
      return mapSettings(result.rows[0]);
    });
  }

  async function listPolicyAcceptances(context) {
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          SELECT policy_acceptance_id, policy_key, policy_version, language, consent_type, status,
                 accepted_at, revoked_at, metadata
          FROM tenant_policy_acceptances
          WHERE tenant_id = $1 AND user_id = $2
          ORDER BY accepted_at DESC
          LIMIT 50
        `,
        [context.tenant.tenantId, context.actor.userId],
      );
      return result.rows.map(mapPolicyAcceptance);
    });
  }

  async function acceptPolicies(context, input = {}) {
    const policyVersion = requiredText(input.policyVersion || "2026-07-14", 40, "Version de politica requerida.");
    const language = validateEnum(input.language || "es", LANGUAGES, "Idioma de politica no soportado.");
    const policies = Array.isArray(input.policies) && input.policies.length > 0
      ? input.policies.map((policy) => requiredText(policy, 80, "Politica no valida."))
      : ["privacy_policy", "terms_of_service", "data_processing", "cookie_policy"];

    return queryForTenant(context, async (client) => {
      const created = [];
      for (const policyKey of policies) {
        const evidence = createEvidenceHash({
          tenantId: context.tenant.tenantId,
          userId: context.actor.userId,
          policyKey,
          policyVersion,
          language,
        });
        const result = await client.query(
          `
            INSERT INTO tenant_policy_acceptances (
              tenant_id, user_id, policy_key, policy_version, language, consent_type, status,
              ip_context, user_agent, evidence_hash, metadata
            )
            VALUES ($1, $2, $3, $4, $5, 'required_terms', 'accepted', $6, $7, $8, $9::jsonb)
            RETURNING policy_acceptance_id, policy_key, policy_version, language, consent_type, status,
                      accepted_at, revoked_at, metadata
          `,
          [
            context.tenant.tenantId,
            context.actor.userId,
            policyKey,
            policyVersion,
            language,
            String(input.ipContext || "").slice(0, 120) || null,
            String(input.userAgent || "").slice(0, 240) || null,
            evidence,
            JSON.stringify({ source: "production-workspace", explicitAcceptance: true }),
          ],
        );
        created.push(mapPolicyAcceptance(result.rows[0]));
      }
      await writeAudit(client, context, "compliance.policies.accepted", "user", context.actor.userId, {
        policyVersion,
        policies,
      });
      return created;
    });
  }

  async function getPrivacyPreferences(context) {
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          INSERT INTO user_privacy_preferences (tenant_id, user_id, updated_by_user_id)
          VALUES ($1, $2, $2)
          ON CONFLICT (tenant_id, user_id) DO UPDATE
          SET updated_at = user_privacy_preferences.updated_at
          RETURNING privacy_preference_id, policy_version, language, necessary_cookies,
                    analytics_cookies, marketing_cookies, email_communications,
                    sms_communications, push_notifications, updated_at, metadata
        `,
        [context.tenant.tenantId, context.actor.userId],
      );
      return mapPrivacyPreferences(result.rows[0]);
    });
  }

  async function getTenantUsage(context) {
    return queryForTenant(context, async (client) => {
      const limits = await ensureUsageLimits(client, context);
      const storage = await client.query(
        `
          SELECT
            COALESCE((SELECT sum(size_bytes) FROM storage_objects WHERE tenant_id = $1 AND status NOT IN ('deleted', 'revoked')), 0)::bigint
              + COALESCE((SELECT sum(storage_size_bytes) FROM documents WHERE tenant_id = $1 AND storage_key IS NOT NULL AND heavy_file_cleaned_at IS NULL), 0)::bigint AS storage_used_bytes,
            (SELECT count(*)::integer FROM documents WHERE tenant_id = $1)::integer AS document_count,
            (SELECT count(*)::integer FROM documents WHERE tenant_id = $1 AND storage_key IS NOT NULL AND heavy_file_cleaned_at IS NULL)::integer AS heavy_file_references,
            (SELECT count(*)::integer FROM documents WHERE tenant_id = $1 AND heavy_file_cleaned_at IS NOT NULL)::integer AS cleaned_heavy_files
        `,
        [context.tenant.tenantId],
      );
      return mapTenantUsage(limits, storage.rows[0]);
    });
  }

  async function updateTenantUsageLimits(context, input = {}) {
    const clean = validateTenantUsageLimits(input);
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          INSERT INTO tenant_usage_limits (
            tenant_id, plan_code, storage_quota_mb, document_quota, photo_evidence_enabled,
            marketing_addon_enabled, dedicated_storage_enabled, updated_by_user_id, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
          ON CONFLICT (tenant_id) DO UPDATE
          SET plan_code = EXCLUDED.plan_code,
              storage_quota_mb = EXCLUDED.storage_quota_mb,
              document_quota = EXCLUDED.document_quota,
              photo_evidence_enabled = EXCLUDED.photo_evidence_enabled,
              marketing_addon_enabled = EXCLUDED.marketing_addon_enabled,
              dedicated_storage_enabled = EXCLUDED.dedicated_storage_enabled,
              updated_by_user_id = EXCLUDED.updated_by_user_id,
              updated_at = now(),
              metadata = EXCLUDED.metadata
          RETURNING tenant_id, plan_code, storage_quota_mb, document_quota, photo_evidence_enabled,
                    marketing_addon_enabled, dedicated_storage_enabled, updated_at, metadata
        `,
        [
          context.tenant.tenantId,
          clean.planCode,
          clean.storageQuotaMb,
          clean.documentQuota,
          clean.photoEvidenceEnabled,
          clean.marketingAddonEnabled,
          clean.dedicatedStorageEnabled,
          context.actor.userId,
          JSON.stringify({ source: "tenant-settings", explicitQuotaConfig: true }),
        ],
      );
      await writeAudit(client, context, "organization.usage_limits.updated", "tenant", context.tenant.tenantId, {
        planCode: clean.planCode,
        storageQuotaMb: clean.storageQuotaMb,
        documentQuota: clean.documentQuota,
        photoEvidenceEnabled: clean.photoEvidenceEnabled,
        dedicatedStorageEnabled: clean.dedicatedStorageEnabled,
      });
      const storage = await client.query(
        `
          SELECT
            COALESCE((SELECT sum(size_bytes) FROM storage_objects WHERE tenant_id = $1 AND status NOT IN ('deleted', 'revoked')), 0)::bigint
              + COALESCE((SELECT sum(storage_size_bytes) FROM documents WHERE tenant_id = $1 AND storage_key IS NOT NULL AND heavy_file_cleaned_at IS NULL), 0)::bigint AS storage_used_bytes,
            (SELECT count(*)::integer FROM documents WHERE tenant_id = $1)::integer AS document_count,
            (SELECT count(*)::integer FROM documents WHERE tenant_id = $1 AND storage_key IS NOT NULL AND heavy_file_cleaned_at IS NULL)::integer AS heavy_file_references,
            (SELECT count(*)::integer FROM documents WHERE tenant_id = $1 AND heavy_file_cleaned_at IS NOT NULL)::integer AS cleaned_heavy_files
        `,
        [context.tenant.tenantId],
      );
      return mapTenantUsage(result.rows[0], storage.rows[0]);
    });
  }

  async function updatePrivacyPreferences(context, input = {}) {
    const clean = validatePrivacyPreferences(input);
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          INSERT INTO user_privacy_preferences (
            tenant_id, user_id, policy_version, language, necessary_cookies,
            analytics_cookies, marketing_cookies, email_communications,
            sms_communications, push_notifications, updated_by_user_id, metadata
          )
          VALUES ($1, $2, $3, $4, true, $5, $6, $7, $8, $9, $2, $10::jsonb)
          ON CONFLICT (tenant_id, user_id) DO UPDATE
          SET policy_version = EXCLUDED.policy_version,
              language = EXCLUDED.language,
              necessary_cookies = true,
              analytics_cookies = EXCLUDED.analytics_cookies,
              marketing_cookies = EXCLUDED.marketing_cookies,
              email_communications = EXCLUDED.email_communications,
              sms_communications = EXCLUDED.sms_communications,
              push_notifications = EXCLUDED.push_notifications,
              updated_by_user_id = EXCLUDED.updated_by_user_id,
              updated_at = now(),
              metadata = EXCLUDED.metadata
          RETURNING privacy_preference_id, policy_version, language, necessary_cookies,
                    analytics_cookies, marketing_cookies, email_communications,
                    sms_communications, push_notifications, updated_at, metadata
        `,
        [
          context.tenant.tenantId,
          context.actor.userId,
          clean.policyVersion,
          clean.language,
          clean.analyticsCookies,
          clean.marketingCookies,
          clean.emailCommunications,
          clean.smsCommunications,
          clean.pushNotifications,
          JSON.stringify({ source: "privacy-center", explicitPreferences: true }),
        ],
      );
      await writeAudit(client, context, "compliance.privacy_preferences.updated", "user", context.actor.userId, {
        policyVersion: clean.policyVersion,
        analyticsCookies: clean.analyticsCookies,
        marketingCookies: clean.marketingCookies,
        emailCommunications: clean.emailCommunications,
        smsCommunications: clean.smsCommunications,
        pushNotifications: clean.pushNotifications,
      });
      return mapPrivacyPreferences(result.rows[0]);
    });
  }

  async function listUsers(context) {
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          SELECT u.user_id, u.email, u.display_name, u.status, u.created_at, u.updated_at,
                 COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles,
                 w.worker_id
          FROM users u
          LEFT JOIN user_roles ur ON ur.tenant_id = u.tenant_id AND ur.user_id = u.user_id
          LEFT JOIN roles r ON r.tenant_id = u.tenant_id AND r.role_id = ur.role_id
          LEFT JOIN workers w ON w.tenant_id = u.tenant_id AND w.user_id = u.user_id
          WHERE u.tenant_id = $1
          GROUP BY u.user_id, w.worker_id
          ORDER BY u.updated_at DESC, u.created_at DESC
          LIMIT 150
        `,
        [context.tenant.tenantId],
      );
      return result.rows.map(mapUser);
    });
  }

  async function createUser(context, input = {}) {
    const clean = validateUserInput(input);
    const temporaryPassword = clean.password || generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    return queryForTenant(context, async (client) => {
      const roleId = await getRoleId(client, context.tenant.tenantId, clean.role);
      const result = await client.query(
        `
          INSERT INTO users (tenant_id, email, display_name, status)
          VALUES ($1, $2, $3, 'active')
          ON CONFLICT (tenant_id, email) DO UPDATE
          SET display_name = EXCLUDED.display_name,
              status = 'active',
              updated_at = now()
          RETURNING user_id
        `,
        [context.tenant.tenantId, clean.email, clean.displayName],
      );
      await replaceUserRole(client, context.tenant.tenantId, result.rows[0].user_id, roleId);
      await upsertPassword(client, context.tenant.tenantId, result.rows[0].user_id, passwordHash);
      await writeAudit(client, context, "organization.user.created", "user", result.rows[0].user_id, {
        role: clean.role,
        passwordStored: "argon2id-hash-only",
      });
      const user = await getUserById(client, context.tenant.tenantId, result.rows[0].user_id);
      const emailDelivery = await queueUserEmail(client, context, user, "user.temporary_access", {
        subject: `Acceso temporal a ${context.tenant.companyName}`,
        bodyText: [
          `Hola ${user.displayName},`,
          `Tu administrador preparo un acceso temporal para ${context.tenant.companyName}.`,
          `Usuario: ${user.email}`,
          "La contrasena temporal debe ser entregada por un canal seguro. No se almacena en este correo.",
          "Si eres administrador, el sistema solicitara segundo factor cuando corresponda.",
        ].join("\n"),
      });
      return { user, temporaryPassword, emailDelivery };
    });
  }

  async function updateUser(context, userId, input = {}) {
    const clean = validateUserUpdateInput(input);
    return queryForTenant(context, async (client) => {
      await requireUserForTenant(client, context.tenant.tenantId, userId);
      if (clean.role) {
        const roleId = await getRoleId(client, context.tenant.tenantId, clean.role);
        await replaceUserRole(client, context.tenant.tenantId, userId, roleId);
      }
      await client.query(
        `
          UPDATE users
          SET display_name = COALESCE($3, display_name),
              status = COALESCE($4, status),
              updated_at = now()
          WHERE tenant_id = $1 AND user_id = $2
        `,
        [context.tenant.tenantId, userId, clean.displayName, clean.status],
      );
      await writeAudit(client, context, "organization.user.updated", "user", userId, {
        fields: Object.keys(clean).filter((key) => clean[key] !== undefined),
      });
      return getUserById(client, context.tenant.tenantId, userId);
    });
  }

  async function resetUserPassword(context, userId, input = {}) {
    const password = nullableText(input.password, 120) || generateTemporaryPassword();
    if (password.length < 14) {
      validationError("La contrasena temporal debe tener al menos 14 caracteres.");
    }
    const passwordHash = await hashPassword(password);
    return queryForTenant(context, async (client) => {
      await requireUserForTenant(client, context.tenant.tenantId, userId);
      await upsertPassword(client, context.tenant.tenantId, userId, passwordHash);
      await client.query(
        "UPDATE auth_sessions SET status = 'revoked', revoked_at = now() WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'",
        [context.tenant.tenantId, userId],
      );
      await writeAudit(client, context, "organization.user.password_reset", "user", userId, { passwordStored: "argon2id-hash-only" });
      const user = await getUserById(client, context.tenant.tenantId, userId);
      const emailDelivery = await queueUserEmail(client, context, user, "user.password_reset", {
        subject: `Contrasena temporal actualizada en ${context.tenant.companyName}`,
        bodyText: [
          `Hola ${user.displayName},`,
          `Tu administrador actualizo el acceso temporal para ${context.tenant.companyName}.`,
          `Usuario: ${user.email}`,
          "La nueva contrasena temporal debe ser entregada por un canal seguro. No se almacena en este correo.",
          "Por seguridad, tus sesiones activas fueron revocadas.",
        ].join("\n"),
      });
      return { user, temporaryPassword: password, emailDelivery };
    });
  }

  async function getPublicTenantBranding(tenantSlug) {
    const cleanSlug = normalizeSlug(tenantSlug);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `
          SELECT tenant_id, name, locale, app_language, logo_url, tenant_slug
          FROM tenants
          WHERE tenant_slug = $1
          LIMIT 1
        `,
        [cleanSlug],
      );
      if (result.rows[0]) {
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [result.rows[0].tenant_id]);
      }
      await client.query("COMMIT");
      const row = result.rows[0];
      if (!row) {
        return null;
      }
      return {
        tenantId: row.tenant_id,
        companyName: row.name,
        locale: row.locale,
        appLanguage: row.app_language || "es",
        logoUrl: row.logo_url || "",
        tenantSlug: row.tenant_slug || "",
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    getSettings,
    updateSettings,
    getPublicTenantBranding,
    listPolicyAcceptances,
    acceptPolicies,
    getPrivacyPreferences,
    updatePrivacyPreferences,
    getTenantUsage,
    updateTenantUsageLimits,
    listUsers,
    createUser,
    updateUser,
    resetUserPassword,
  };
}

async function ensureUsageLimits(client, context) {
  const result = await client.query(
    `
      INSERT INTO tenant_usage_limits (tenant_id, updated_by_user_id)
      VALUES ($1, $2)
      ON CONFLICT (tenant_id) DO UPDATE
      SET updated_at = tenant_usage_limits.updated_at
      RETURNING tenant_id, plan_code, storage_quota_mb, document_quota, photo_evidence_enabled,
                marketing_addon_enabled, dedicated_storage_enabled, updated_at, metadata
    `,
    [context.tenant.tenantId, context.actor.userId],
  );
  return result.rows[0];
}

function validateTenantUsageLimits(input = {}) {
  const planCode = validateEnum(input.planCode || input.plan_code || "starter", PLAN_CODES, "Plan no soportado.");
  const storageQuotaMb = boundedInteger(input.storageQuotaMb || input.storage_quota_mb || 1024, 50, 1_048_576, "Cuota de almacenamiento no valida.");
  const documentQuota = boundedInteger(input.documentQuota || input.document_quota || 5000, 50, 10_000_000, "Cuota de documentos no valida.");
  return {
    planCode,
    storageQuotaMb,
    documentQuota,
    photoEvidenceEnabled: Boolean(input.photoEvidenceEnabled ?? input.photo_evidence_enabled),
    marketingAddonEnabled: input.marketingAddonEnabled === undefined && input.marketing_addon_enabled === undefined ? true : Boolean(input.marketingAddonEnabled ?? input.marketing_addon_enabled),
    dedicatedStorageEnabled: Boolean(input.dedicatedStorageEnabled ?? input.dedicated_storage_enabled),
  };
}

function validatePrivacyPreferences(input = {}) {
  return {
    policyVersion: requiredText(input.policyVersion || PRIVACY_POLICY_VERSION, 40, "Version de privacidad requerida."),
    language: validateEnum(input.language || "es", LANGUAGES, "Idioma de privacidad no soportado."),
    analyticsCookies: Boolean(input.analyticsCookies),
    marketingCookies: Boolean(input.marketingCookies),
    emailCommunications: Boolean(input.emailCommunications),
    smsCommunications: Boolean(input.smsCommunications),
    pushNotifications: Boolean(input.pushNotifications),
  };
}

function validateSettings(input) {
  const countryProfile = validateEnum(input.countryProfile || input.country_profile || "US", COUNTRIES, "Pais/mercado no soportado.");
  const defaults = COUNTRY_DEFAULTS[countryProfile];
  const currency = validateEnum(input.currency || defaults.currency, CURRENCIES, "Moneda no soportada.");
  const unitSystem = validateEnum(input.unitSystem || input.unit_system || defaults.unitSystem, UNIT_SYSTEMS, "Sistema de unidades no soportado.");
  const appLanguage = validateEnum(input.appLanguage || input.app_language || "es", LANGUAGES, "Idioma de app no soportado.");
  const documentLanguage = validateEnum(input.documentLanguage || input.document_language || appLanguage, LANGUAGES, "Idioma documental no soportado.");
  return {
    companyName: requiredText(input.companyName || input.name, 160, "Nombre de empresa requerido."),
    locale: requiredText(input.locale || defaults.locale, 16, "Locale requerido."),
    timezone: requiredText(input.timezone || defaults.timezone, 80, "Zona horaria requerida."),
    countryProfile,
    currency,
    unitSystem,
    appLanguage,
    documentLanguage,
    tenantSlug: normalizeSlug(input.tenantSlug || input.tenant_slug || ""),
    legalName: nullableText(input.legalName || input.legal_name, 180),
    taxId: nullableText(input.taxId || input.tax_id, 80),
    contractorLicense: nullableText(input.contractorLicense || input.contractor_license, 120),
    companyAddress: nullableText(input.companyAddress || input.company_address, 240),
    companyCity: nullableText(input.companyCity || input.company_city, 120),
    companyRegion: nullableText(input.companyRegion || input.company_region, 120),
    companyPostalCode: nullableText(input.companyPostalCode || input.company_postal_code, 40),
    companyCountry: nullableText(input.companyCountry || input.company_country, 80),
    companyPhone: nullableText(input.companyPhone || input.company_phone, 80),
    workerSupportPhone: nullableText(input.workerSupportPhone || input.worker_support_phone, 80),
    workerSupportWhatsappUrl: nullableText(input.workerSupportWhatsappUrl || input.worker_support_whatsapp_url, 500),
    companyEmail: nullableText(input.companyEmail || input.company_email, 180),
    companyWebsite: nullableText(input.companyWebsite || input.company_website, 180),
    logoUrl: nullableText(input.logoUrl || input.logo_url, 500),
    estimateTemplateId: validateEnum(input.estimateTemplateId || input.estimate_template_id || "estimate_classic_blue", ESTIMATE_TEMPLATES, "Plantilla de cotizacion no soportada."),
    invoiceTemplateId: validateEnum(input.invoiceTemplateId || input.invoice_template_id || "invoice_clean_red", INVOICE_TEMPLATES, "Plantilla de factura no soportada."),
    documentCompanyVisibility: normalizeVisibility(input.documentCompanyVisibility || input.document_company_visibility),
    documentSignature: normalizeSignature(input.documentSignature || input.document_signature),
  };
}

function mapSettings(row = {}) {
  const countryProfile = row.country_profile || "US";
  const defaults = COUNTRY_DEFAULTS[countryProfile] || COUNTRY_DEFAULTS.US;
  return {
    tenantId: row.tenant_id,
    companyName: row.name || "",
    industryProfile: row.industry_profile || "construction",
    countryProfile,
    currency: row.currency || defaults.currency,
    unitSystem: row.unit_system || defaults.unitSystem,
    locale: row.locale || defaults.locale,
    timezone: row.timezone || defaults.timezone,
    appLanguage: row.app_language || "es",
    documentLanguage: row.document_language || "es",
    tenantSlug: row.tenant_slug || "",
    legalName: row.legal_name || "",
    taxId: row.tax_id || "",
    contractorLicense: row.contractor_license || "",
    companyAddress: row.company_address || "",
    companyCity: row.company_city || "",
    companyRegion: row.company_region || "",
    companyPostalCode: row.company_postal_code || "",
    companyCountry: row.company_country || "",
    companyPhone: row.company_phone || "",
    workerSupportPhone: row.worker_support_phone || "",
    workerSupportWhatsappUrl: row.worker_support_whatsapp_url || "",
    companyEmail: row.company_email || "",
    companyWebsite: row.company_website || "",
    logoUrl: row.logo_url || "",
    estimateTemplateId: row.estimate_template_id || "estimate_classic_blue",
    invoiceTemplateId: row.invoice_template_id || "invoice_clean_red",
    documentCompanyVisibility: normalizeVisibility(row.document_company_visibility),
    documentSignature: normalizeSignature(row.document_signature),
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at || "",
  };
}

function normalizeVisibility(value = {}) {
  const input = typeof value === "object" && value ? value : {};
  return {
    logo: input.logo !== false,
    commercialName: input.commercialName !== false,
    legalName: input.legalName !== false,
    taxId: input.taxId !== false,
    license: input.license !== false,
    address: input.address !== false,
    phone: input.phone !== false,
    email: input.email !== false,
    website: input.website !== false,
  };
}

function normalizeSignature(value = {}) {
  const input = typeof value === "object" && value ? value : {};
  return {
    name: nullableText(input.name, 160) || "",
    title: nullableText(input.title, 160) || "",
    imageUrl: nullableText(input.imageUrl, 500) || "",
  };
}

function mapPolicyAcceptance(row) {
  return {
    acceptanceId: row.policy_acceptance_id,
    policyKey: row.policy_key,
    policyVersion: row.policy_version,
    language: row.language,
    consentType: row.consent_type,
    status: row.status,
    acceptedAt: row.accepted_at?.toISOString?.() || row.accepted_at,
    revokedAt: row.revoked_at?.toISOString?.() || row.revoked_at,
    metadata: row.metadata || {},
  };
}

function mapPrivacyPreferences(row = {}) {
  return {
    preferenceId: row.privacy_preference_id,
    policyVersion: row.policy_version || PRIVACY_POLICY_VERSION,
    language: row.language || "es",
    necessaryCookies: row.necessary_cookies !== false,
    analyticsCookies: Boolean(row.analytics_cookies),
    marketingCookies: Boolean(row.marketing_cookies),
    emailCommunications: Boolean(row.email_communications),
    smsCommunications: Boolean(row.sms_communications),
    pushNotifications: Boolean(row.push_notifications),
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at || "",
    metadata: row.metadata || {},
  };
}

function mapTenantUsage(limits = {}, usage = {}) {
  const storageQuotaMb = Number(limits.storage_quota_mb || 1024);
  const documentQuota = Number(limits.document_quota || 5000);
  const storageUsedBytes = Number(usage.storage_used_bytes || 0);
  const storageQuotaBytes = storageQuotaMb * 1024 * 1024;
  const documentCount = Number(usage.document_count || 0);
  const storageUsagePercent = storageQuotaBytes > 0 ? Math.round((storageUsedBytes / storageQuotaBytes) * 1000) / 10 : 0;
  const documentUsagePercent = documentQuota > 0 ? Math.round((documentCount / documentQuota) * 1000) / 10 : 0;
  const status = storageUsagePercent >= 100 || documentUsagePercent >= 100
    ? "blocked"
    : storageUsagePercent >= 90 || documentUsagePercent >= 90
      ? "danger"
      : storageUsagePercent >= 75 || documentUsagePercent >= 75
        ? "warning"
        : "ok";
  return {
    planCode: limits.plan_code || "starter",
    storageQuotaMb,
    storageUsedBytes,
    storageUsagePercent,
    documentQuota,
    documentCount,
    documentUsagePercent,
    heavyFileReferences: Number(usage.heavy_file_references || 0),
    cleanedHeavyFiles: Number(usage.cleaned_heavy_files || 0),
    photoEvidenceEnabled: Boolean(limits.photo_evidence_enabled),
    marketingAddonEnabled: limits.marketing_addon_enabled !== false,
    dedicatedStorageEnabled: Boolean(limits.dedicated_storage_enabled),
    status,
    updatedAt: limits.updated_at?.toISOString?.() || limits.updated_at || "",
  };
}

function mapUser(row = {}) {
  return {
    userId: row.user_id,
    email: row.email || "",
    displayName: row.display_name || "",
    status: row.status || "",
    roles: Array.isArray(row.roles) ? row.roles.filter(Boolean) : [],
    workerId: row.worker_id || null,
    createdAt: row.created_at?.toISOString?.() || row.created_at || "",
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at || "",
  };
}

async function getUserById(client, tenantId, userId) {
  const result = await client.query(
    `
      SELECT u.user_id, u.email, u.display_name, u.status, u.created_at, u.updated_at,
             COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles,
             w.worker_id
      FROM users u
      LEFT JOIN user_roles ur ON ur.tenant_id = u.tenant_id AND ur.user_id = u.user_id
      LEFT JOIN roles r ON r.tenant_id = u.tenant_id AND r.role_id = ur.role_id
      LEFT JOIN workers w ON w.tenant_id = u.tenant_id AND w.user_id = u.user_id
      WHERE u.tenant_id = $1 AND u.user_id = $2
      GROUP BY u.user_id, w.worker_id
    `,
    [tenantId, userId],
  );
  if (!result.rows[0]) {
    notFound("Usuario no encontrado para esta empresa.");
  }
  return mapUser(result.rows[0]);
}

async function requireUserForTenant(client, tenantId, userId) {
  const result = await client.query("SELECT user_id FROM users WHERE tenant_id = $1 AND user_id = $2", [tenantId, userId]);
  if (!result.rows[0]) {
    notFound("Usuario no encontrado para esta empresa.");
  }
}

async function getRoleId(client, tenantId, roleCode) {
  const result = await client.query("SELECT role_id FROM roles WHERE tenant_id = $1 AND code = $2", [tenantId, roleCode]);
  if (!result.rows[0]) {
    validationError("Rol no configurado para esta empresa.");
  }
  return result.rows[0].role_id;
}

async function replaceUserRole(client, tenantId, userId, roleId) {
  await client.query("DELETE FROM user_roles WHERE tenant_id = $1 AND user_id = $2", [tenantId, userId]);
  await client.query(
    "INSERT INTO user_roles (tenant_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT (user_id, role_id) DO NOTHING",
    [tenantId, userId, roleId],
  );
}

async function upsertPassword(client, tenantId, userId, passwordHash) {
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
}

async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

async function writeAudit(client, context, action, entityType, entityId, metadata) {
  await client.query(
    `
      INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, $2, $3, 'organization', $4, $5, 'info', $6::jsonb)
    `,
    [context.tenant.tenantId, context.actor.userId, action, entityType, entityId, JSON.stringify(metadata || {})],
  );
}

async function queueUserEmail(client, context, user, templateKey, options = {}) {
  const deliveryConfig = resolveEmailDeliveryConfig();
  const result = await client.query(
    `
      INSERT INTO email_deliveries (
        tenant_id, recipient_email, recipient_name, from_email, reply_to_email,
        subject, body_text, template_key, provider, status,
        related_entity_type, related_entity_id, metadata, queued_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'user', $11, $12::jsonb, $13)
      RETURNING email_delivery_id, recipient_email, recipient_name, subject, template_key, provider, status,
                related_entity_type, related_entity_id, queued_at, sent_at
    `,
    [
      context.tenant.tenantId,
      user.email,
      user.displayName,
      deliveryConfig.fromEmail,
      deliveryConfig.replyToEmail,
      options.subject,
      options.bodyText,
      templateKey,
      deliveryConfig.provider,
      deliveryConfig.status,
      user.userId,
      JSON.stringify(createEmailMetadata({ passwordPersisted: false, source: "organization-users" })),
      context.actor.userId,
    ],
  );
  await writeAudit(client, context, `organization.user.email.${result.rows[0].status}`, "user", user.userId, {
    templateKey,
    emailDeliveryId: result.rows[0].email_delivery_id,
  });
  return {
    emailDeliveryId: result.rows[0].email_delivery_id,
    recipientEmail: result.rows[0].recipient_email,
    recipientName: result.rows[0].recipient_name || "",
    subject: result.rows[0].subject,
    templateKey: result.rows[0].template_key,
    provider: result.rows[0].provider,
    status: result.rows[0].status,
    relatedEntityType: result.rows[0].related_entity_type,
    relatedEntityId: result.rows[0].related_entity_id,
    queuedAt: result.rows[0].queued_at?.toISOString?.() || result.rows[0].queued_at || "",
    sentAt: result.rows[0].sent_at?.toISOString?.() || result.rows[0].sent_at || "",
  };
}

function createEvidenceHash(value) {
  return createHash("sha256").update(JSON.stringify({ ...value, acceptedAtBucket: new Date().toISOString().slice(0, 10) })).digest("hex");
}

function validateEnum(value, allowed, message) {
  const normalized = String(value || "").trim();
  if (!allowed.has(normalized)) {
    validationError(message);
  }
  return normalized;
}

function validateUserInput(input) {
  const password = nullableText(input.password, 120);
  if (password && password.length < 14) {
    validationError("La contrasena temporal debe tener al menos 14 caracteres.");
  }
  return {
    email: normalizeEmail(requiredText(input.email, 180, "Correo requerido.")),
    displayName: requiredText(input.displayName, 160, "Nombre de usuario requerido."),
    role: validateEnum(input.role || "worker", USER_ROLES, "Rol no soportado."),
    password,
  };
}

function validateUserUpdateInput(input) {
  return {
    displayName: input.displayName === undefined ? undefined : requiredText(input.displayName, 160, "Nombre de usuario requerido."),
    status: input.status === undefined ? undefined : validateEnum(input.status, USER_STATUSES, "Estado de usuario no soportado."),
    role: input.role === undefined ? undefined : validateEnum(input.role, USER_ROLES, "Rol no soportado."),
  };
}

function normalizeSlug(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) {
    return null;
  }
  const slug = text.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  if (slug.length < 3) {
    validationError("El subdominio debe tener al menos 3 caracteres.");
  }
  return slug;
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    validationError("Correo no valido.");
  }
  return email;
}

function boundedInteger(value, min, max, message) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    validationError(message);
  }
  return number;
}

function assertUuid(value, message) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(String(value || ""))) {
    validationError(message);
  }
}

function nullableText(value, maxLength) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  if (text.length > maxLength) {
    validationError(`El campo excede ${maxLength} caracteres.`);
  }
  return text;
}

function generateTemporaryPassword() {
  return randomBytes(18).toString("base64url");
}

function requiredText(value, maxLength, message) {
  const text = String(value || "").trim();
  if (text.length < 1 || text.length > maxLength) {
    validationError(message);
  }
  return text;
}

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = "VALIDATION_ERROR";
  throw error;
}

function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  error.code = "NOT_FOUND";
  throw error;
}
