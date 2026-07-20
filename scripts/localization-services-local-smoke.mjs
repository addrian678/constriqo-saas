import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createRuntimeServer } from "../server/runtime/server.mjs";
import { createPostgresOrganizationRepositoryFromEnv } from "../server/runtime/postgresOrganizationRepository.mjs";
import { createPostgresServiceCatalogRepositoryFromEnv } from "../server/runtime/postgresServiceCatalogRepository.mjs";

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

if (!adminDatabaseUrl || !runtimeDatabaseUrl) {
  console.log("Localization/services local smoke skipped: ADMIN_DATABASE_URL and RUNTIME_DATABASE_URL are required.");
  process.exit(0);
}

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 2 });
const organizationRepository = createPostgresOrganizationRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
const serviceCatalogRepository = createPostgresServiceCatalogRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
let server;
let address;
let serviceAId;

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
      INSERT INTO tenants (tenant_id, name, industry_profile, locale, currency, timezone, country_profile, unit_system, app_language, document_language)
      VALUES
        ($1, 'Localization Tenant A', 'construction', 'en-US', 'USD', 'America/Denver', 'US', 'imperial', 'en', 'en'),
        ($2, 'Localization Tenant B', 'construction', 'es-CO', 'COP', 'America/Bogota', 'CO', 'metric', 'es', 'es')
    `,
    [tenantA, tenantB],
  );
  await withTenantAdmin(tenantA, async (client) => {
    await client.query(
      "INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, $3, $4, 'active')",
      [userA, tenantA, "localization-a@local.test", "Localization A"],
    );
  });
  await withTenantAdmin(tenantB, async (client) => {
    await client.query(
      "INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, $3, $4, 'active')",
      [userB, tenantB, "localization-b@local.test", "Localization B"],
    );
  });
}

function contextForToken(token) {
  const isB = token === "tenant-b";
  return {
    tenant: { tenantId: isB ? tenantB : tenantA, companyName: isB ? "Localization Tenant B" : "Localization Tenant A" },
    actor: {
      userId: isB ? userB : userA,
      role: "admin",
      roles: ["admin"],
      capabilities: ["organization.read", "organization.manage", "estimates.read", "estimates.update"],
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
    organizationRepository,
    serviceCatalogRepository,
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

  const settingsA = await request("tenant-a", "/api/organization/settings");
  check("Tenant A lee settings", settingsA.status === 200 && settingsA.body.settings?.countryProfile === "US", JSON.stringify(settingsA.body));

  const updateA = await request("tenant-a", "/api/organization/settings", {
    method: "PATCH",
    body: {
      companyName: "Localization Tenant A LLC",
      countryProfile: "US",
      currency: "USD",
      unitSystem: "imperial",
      appLanguage: "en",
      documentLanguage: "en",
      locale: "en-US",
      timezone: "America/Denver",
      tenantSlug: "localization-a",
    },
  });
  check("Tenant A actualiza settings", updateA.status === 200 && updateA.body.settings?.tenantSlug === "localization-a", JSON.stringify(updateA.body));

  const policiesA = await request("tenant-a", "/api/compliance/policy-acceptances", {
    method: "POST",
    body: { policyVersion: "2026-07-14", language: "en" },
  });
  check("Tenant A registra politicas", policiesA.status === 201 && policiesA.body.total === 4, JSON.stringify(policiesA.body));

  const privacyDefaultA = await request("tenant-a", "/api/compliance/privacy-preferences");
  check(
    "Tenant A privacidad no esencial apagada",
    privacyDefaultA.status === 200 &&
      privacyDefaultA.body.preferences?.necessaryCookies === true &&
      privacyDefaultA.body.preferences?.analyticsCookies === false &&
      privacyDefaultA.body.preferences?.marketingCookies === false,
    JSON.stringify(privacyDefaultA.body),
  );

  const privacyUpdateA = await request("tenant-a", "/api/compliance/privacy-preferences", {
    method: "PATCH",
    body: {
      policyVersion: "2026-07-15",
      language: "en",
      analyticsCookies: true,
      marketingCookies: false,
      emailCommunications: true,
      smsCommunications: false,
      pushNotifications: false,
    },
  });
  check(
    "Tenant A actualiza preferencias privacidad",
    privacyUpdateA.status === 200 &&
      privacyUpdateA.body.preferences?.analyticsCookies === true &&
      privacyUpdateA.body.preferences?.emailCommunications === true &&
      privacyUpdateA.body.preferences?.marketingCookies === false,
    JSON.stringify(privacyUpdateA.body),
  );

  const usageDefaultA = await request("tenant-a", "/api/organization/usage");
  check(
    "Tenant A cuotas iniciales SaaS",
    usageDefaultA.status === 200 &&
      usageDefaultA.body.usage?.planCode === "starter" &&
      usageDefaultA.body.usage?.storageQuotaMb === 1024 &&
      usageDefaultA.body.usage?.documentQuota === 5000 &&
      usageDefaultA.body.usage?.photoEvidenceEnabled === false,
    JSON.stringify(usageDefaultA.body),
  );

  const usageUpdateA = await request("tenant-a", "/api/organization/usage", {
    method: "PATCH",
    body: {
      planCode: "growth",
      storageQuotaMb: 2048,
      documentQuota: 9000,
      photoEvidenceEnabled: true,
      marketingAddonEnabled: true,
      dedicatedStorageEnabled: false,
    },
  });
  check(
    "Tenant A actualiza plan y cuotas",
    usageUpdateA.status === 200 &&
      usageUpdateA.body.usage?.planCode === "growth" &&
      usageUpdateA.body.usage?.storageQuotaMb === 2048 &&
      usageUpdateA.body.usage?.documentQuota === 9000 &&
      usageUpdateA.body.usage?.photoEvidenceEnabled === true &&
      usageUpdateA.body.usage?.status === "ok",
    JSON.stringify(usageUpdateA.body),
  );

  const usageDefaultB = await request("tenant-b", "/api/organization/usage");
  check(
    "Tenant B conserva sus cuotas separadas",
    usageDefaultB.status === 200 &&
      usageDefaultB.body.usage?.planCode === "starter" &&
      usageDefaultB.body.usage?.storageQuotaMb === 1024 &&
      usageDefaultB.body.usage?.photoEvidenceEnabled === false,
    JSON.stringify(usageDefaultB.body),
  );

  const serviceA = await request("tenant-a", "/api/services/prices", {
    method: "POST",
    body: {
      code: "TILE-SQFT",
      name: "Tile installation",
      category: "flooring",
      description: "Install ceramic tile by square foot.",
      countryProfile: "US",
      unitSystem: "imperial",
      unitCode: "sq_ft",
      currency: "USD",
      unitPrice: 12.5,
      unitCost: 7,
      defaultTaxRate: 7.25,
      marginPercent: 35,
      minimumQuantity: 10,
      inclusions: "Labor",
      exclusions: "Material",
      conditions: "Site ready",
    },
  });
  serviceAId = serviceA.body.service?.serviceId;
  check("Tenant A crea servicio", serviceA.status === 201 && Boolean(serviceAId), JSON.stringify(serviceA.body));

  const listA = await request("tenant-a", "/api/services/prices");
  check("Tenant A ve su servicio", listA.status === 200 && listA.body.items.some((item) => item.serviceId === serviceAId), JSON.stringify(listA.body));

  const listB = await request("tenant-b", "/api/services/prices");
  check("Tenant B no ve servicio A", listB.status === 200 && !listB.body.items.some((item) => item.serviceId === serviceAId), JSON.stringify(listB.body));

  const archiveB = await request("tenant-b", `/api/services/prices/${serviceAId}`, { method: "DELETE" });
  check("Tenant B no archiva servicio A", archiveB.status === 404, JSON.stringify(archiveB.body));

  const auditCount = await withTenantAdmin(tenantA, (client) =>
    client.query("SELECT count(*)::integer AS total FROM audit_events WHERE tenant_id = $1 AND module_id IN ('organization', 'services-prices')", [tenantA]),
  );
  check("Settings/servicios/privacidad/cuotas generan auditoria", auditCount.rows[0].total >= 5, JSON.stringify(auditCount.rows[0]));
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await organizationRepository?.close?.();
  await serviceCatalogRepository?.close?.();
  for (const tenantId of [tenantA, tenantB]) {
    await withTenantAdmin(tenantId, async (client) => {
      await client.query("DELETE FROM tenant_policy_acceptances WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM user_privacy_preferences WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM tenant_usage_limits WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM service_catalog_items WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
    }).catch(() => {});
  }
  await adminPool.query("DELETE FROM tenants WHERE tenant_id = ANY($1::uuid[])", [[tenantA, tenantB]]).catch(() => {});
  await adminPool.end();
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Localization/services local smoke failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Localization/services local smoke passed with ${checks.length} checks.`);
