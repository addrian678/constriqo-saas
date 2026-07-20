import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createRuntimeServer } from "../server/runtime/server.mjs";
import { createPostgresMarketingRepositoryFromEnv } from "../server/runtime/postgresMarketingRepository.mjs";
import { createPostgresOrganizationRepositoryFromEnv } from "../server/runtime/postgresOrganizationRepository.mjs";

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

if (!adminDatabaseUrl || !runtimeDatabaseUrl) {
  console.log("Marketing local smoke skipped: ADMIN_DATABASE_URL and RUNTIME_DATABASE_URL are required.");
  process.exit(0);
}

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 2 });
const marketingRepository = createPostgresMarketingRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
const organizationRepository = createPostgresOrganizationRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
let server;
let address;
let campaignAId;
let leadAId;
let loyaltyCardAId;

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
        ($1, 'Marketing Tenant A', 'construction', 'es-US', 'USD', 'America/Denver'),
        ($2, 'Marketing Tenant B', 'construction', 'es-US', 'USD', 'America/Denver')
    `,
    [tenantA, tenantB],
  );
  await withTenantAdmin(tenantA, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'marketing-a@local.test', 'Marketing A', 'active')", [userA, tenantA]);
  });
  await withTenantAdmin(tenantB, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'marketing-b@local.test', 'Marketing B', 'active')", [userB, tenantB]);
  });
}

function contextForToken(token) {
  const isB = token === "tenant-b";
  return {
    tenant: { tenantId: isB ? tenantB : tenantA, companyName: isB ? "Marketing Tenant B" : "Marketing Tenant A" },
    actor: {
      userId: isB ? userB : userA,
      role: "admin",
      roles: ["admin"],
      capabilities: ["marketing.read", "marketing.manage", "marketing.leads.convert"],
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
    marketingRepository,
    organizationRepository,
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

  const campaign = await request("tenant-a", "/api/marketing/campaigns", {
    method: "POST",
    body: { name: "Campana smoke", channel: "manual", status: "active", budgetAmount: 250 },
  });
  campaignAId = campaign.body.campaign?.campaignId;
  check("Tenant A crea campana", campaign.status === 201 && campaignAId, JSON.stringify(campaign.body));

  const lead = await request("tenant-a", "/api/marketing/leads", {
    method: "POST",
    body: {
      campaignId: campaignAId,
      name: "Lead Smoke",
      source: "web",
      serviceInterest: "Ceramica",
      status: "qualified",
      consentStatus: "accepted",
      email: "lead-smoke@example.com",
      phone: "555-0199",
    },
  });
  leadAId = lead.body.lead?.leadId;
  check("Tenant A crea lead consentido", lead.status === 201 && leadAId && lead.body.lead?.consentStatus === "accepted", JSON.stringify(lead.body));

  const leadsA = await request("tenant-a", "/api/marketing/leads");
  check("Tenant A ve lead", leadsA.status === 200 && leadsA.body.items.some((item) => item.leadId === leadAId), JSON.stringify(leadsA.body));

  const leadsB = await request("tenant-b", "/api/marketing/leads");
  check("Tenant B no ve lead A", leadsB.status === 200 && !leadsB.body.items.some((item) => item.leadId === leadAId), JSON.stringify(leadsB.body));

  const convert = await request("tenant-a", `/api/marketing/leads/${leadAId}/convert`, { method: "POST" });
  check("Lead convertido crea cliente CRM", convert.status === 200 && convert.body.clientId && convert.body.lead?.status === "converted", JSON.stringify(convert.body));

  const loyaltyCard = await request("tenant-a", "/api/marketing/loyalty-cards", {
    method: "POST",
    body: {
      title: "Tarjeta Smoke",
      customerName: "Lead Smoke",
      customerPhone: "555-0199",
      requiredStamps: 10,
      currentStamps: 2,
      rewardType: "discount_percent",
      rewardValue: 20,
      rewardDescription: "20% de descuento al completar 10 sellos",
    },
  });
  loyaltyCardAId = loyaltyCard.body.card?.loyaltyCardId;
  check(
    "Tenant A crea tarjeta fidelizacion",
    loyaltyCard.status === 201 && loyaltyCardAId && /^LOY-\d{6}$/u.test(loyaltyCard.body.card?.cardCode || "") && loyaltyCard.body.card?.requiredStamps === 10,
    JSON.stringify(loyaltyCard.body),
  );

  const editedLoyaltyCard = await request("tenant-a", `/api/marketing/loyalty-cards/${loyaltyCardAId}`, {
    method: "PATCH",
    body: { currentStamps: 3, rewardDescription: "25% de descuento al completar 10 sellos" },
  });
  check(
    "Tenant A edita tarjeta fidelizacion",
    editedLoyaltyCard.status === 200 && editedLoyaltyCard.body.card?.currentStamps === 3 && editedLoyaltyCard.body.card?.rewardDescription.includes("25%"),
    JSON.stringify(editedLoyaltyCard.body),
  );

  const redeemedLoyaltyCard = await request("tenant-a", `/api/marketing/loyalty-cards/${loyaltyCardAId}`, {
    method: "PATCH",
    body: { status: "redeemed", currentStamps: 10 },
  });
  check(
    "Tenant A canjea tarjeta fidelizacion",
    redeemedLoyaltyCard.status === 200 && redeemedLoyaltyCard.body.card?.status === "redeemed" && redeemedLoyaltyCard.body.card?.currentStamps === 10,
    JSON.stringify(redeemedLoyaltyCard.body),
  );

  const loyaltyCardsA = await request("tenant-a", "/api/marketing/loyalty-cards");
  check("Tenant A ve tarjeta", loyaltyCardsA.status === 200 && loyaltyCardsA.body.items.some((item) => item.loyaltyCardId === loyaltyCardAId), JSON.stringify(loyaltyCardsA.body));

  const loyaltyCardsB = await request("tenant-b", "/api/marketing/loyalty-cards");
  check("Tenant B no ve tarjeta A", loyaltyCardsB.status === 200 && !loyaltyCardsB.body.items.some((item) => item.loyaltyCardId === loyaltyCardAId), JSON.stringify(loyaltyCardsB.body));

  const clientCount = await withTenantAdmin(tenantA, (client) =>
    client.query("SELECT count(*)::integer AS total FROM clients WHERE tenant_id = $1 AND email = 'lead-smoke@example.com'", [tenantA]),
  );
  check("Cliente CRM existe en tenant A", clientCount.rows[0].total === 1, JSON.stringify(clientCount.rows[0]));

  const audit = await withTenantAdmin(tenantA, (client) =>
    client.query("SELECT count(*)::integer AS total FROM audit_events WHERE tenant_id = $1 AND module_id = 'marketing'", [tenantA]),
  );
  check("Marketing genera auditoria", audit.rows[0].total >= 6, JSON.stringify(audit.rows[0]));

  await withTenantAdmin(tenantA, async (client) => {
    await client.query(
      `
        INSERT INTO tenant_usage_limits (tenant_id, marketing_addon_enabled, updated_by_user_id)
        VALUES ($1, false, $2)
        ON CONFLICT (tenant_id) DO UPDATE
        SET marketing_addon_enabled = false,
            updated_by_user_id = EXCLUDED.updated_by_user_id,
            updated_at = now()
      `,
      [tenantA, userA],
    );
  });
  const disabledMarketing = await request("tenant-a", "/api/marketing/leads");
  check("Tenant A bloquea marketing si add-on esta apagado", disabledMarketing.status === 402 && disabledMarketing.body.code === "ADDON_DISABLED", JSON.stringify(disabledMarketing.body));
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await marketingRepository?.close?.();
  await organizationRepository?.close?.();
  for (const tenantId of [tenantA, tenantB]) {
    await withTenantAdmin(tenantId, async (client) => {
      await client.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM tenant_usage_limits WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM marketing_loyalty_cards WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM marketing_followups WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM marketing_leads WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM marketing_campaigns WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM clients WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
    }).catch(() => {});
  }
  await adminPool.query("DELETE FROM tenants WHERE tenant_id = ANY($1::uuid[])", [[tenantA, tenantB]]).catch(() => {});
  await adminPool.end();
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Marketing local smoke failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Marketing local smoke passed with ${checks.length} checks.`);
