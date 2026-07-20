import { randomUUID } from "node:crypto";
import pg from "pg";
import { createRuntimeServer } from "../server/runtime/server.mjs";
import { createPostgresEstimateRepository } from "../server/runtime/postgresEstimateRepository.mjs";
import { createPostgresInvoiceRepository } from "../server/runtime/postgresInvoiceRepository.mjs";
import { createPostgresNotificationsRepository } from "../server/runtime/postgresNotificationsRepository.mjs";
import { createPostgresOrganizationRepository } from "../server/runtime/postgresOrganizationRepository.mjs";

const { Pool } = pg;
const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;

if (!adminDatabaseUrl) {
  console.error("ADMIN_DATABASE_URL or DATABASE_URL is required for email smoke.");
  process.exit(1);
}

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const clientA = randomUUID();
const clientB = randomUUID();

const adminPool = new Pool({
  connectionString: adminDatabaseUrl,
  max: 2,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : false,
});

async function main() {
  await setupTenant(tenantA, userA, clientA, "Smoke Email A", "cliente-email-a@example.com");
  await setupTenant(tenantB, userB, clientB, "Smoke Email B", "cliente-email-b@example.com");

  const server = createRuntimeServer({
    estimateRepository: createPostgresEstimateRepository(adminPool),
    invoiceRepository: createPostgresInvoiceRepository(adminPool),
    notificationsRepository: createPostgresNotificationsRepository(adminPool),
    organizationRepository: null,
    sessionContextResolver: {
      async resolve({ authorizationHeader }) {
        const token = String(authorizationHeader || "").replace(/^Bearer\s+/iu, "");
        const tenantId = token === "tenant-b" ? tenantB : tenantA;
        const userId = token === "tenant-b" ? userB : userA;
        return {
          requestId: "email-smoke",
          tenant: { tenantId, companyName: token === "tenant-b" ? "Smoke Email B" : "Smoke Email A" },
          actor: {
            userId,
            role: "admin",
            roles: ["admin"],
            capabilities: [
              "estimates.read",
              "estimates.create",
              "email.deliveries.send",
              "invoices.read",
              "invoices.create",
              "email.deliveries.read",
            ],
          },
        };
      },
    },
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const estimate = await request(port, "tenant-a", "/api/estimates", {
      method: "POST",
      body: {
        clientId: clientA,
        title: "Smoke estimate",
        scope: "Smoke scope",
        currency: "USD",
        countryProfile: "US",
        unitSystem: "imperial",
        documentLanguage: "en",
        sections: [
          {
            title: "Services",
            items: [{ description: "Install", quantity: 2, unitCode: "hour", unitPrice: 50 }],
          },
        ],
      },
    });
    assert(estimate.status === 201, "estimate created");
    const estimateEmail = await request(port, "tenant-a", `/api/estimates/${estimate.body.estimate.estimateId}/send-email`, {
      method: "POST",
      body: {},
    });
    assert(estimateEmail.status === 202 && estimateEmail.body.delivery.status === "sandboxed", "estimate email sandboxed");
    assert(estimateEmail.body.delivery.recipientEmail === "cliente-email-a@example.com", "estimate email recipient resolved");

    const blocked = await request(port, "tenant-b", `/api/estimates/${estimate.body.estimate.estimateId}/send-email`, {
      method: "POST",
      body: {},
    });
    assert(blocked.status === 404, "tenant B cannot send tenant A estimate");

    const invoice = await request(port, "tenant-a", "/api/invoicing/invoices", {
      method: "POST",
      body: {
        clientId: clientA,
        title: "Smoke invoice",
        currency: "USD",
        countryProfile: "US",
        documentLanguage: "en",
        items: [{ description: "Install", quantity: 1, unitCode: "unit", unitPrice: 100 }],
      },
    });
    assert(invoice.status === 201, "invoice created");
    const invoiceEmail = await request(port, "tenant-a", `/api/invoicing/invoices/${invoice.body.invoice.invoiceId}/send-email`, {
      method: "POST",
      body: {},
    });
    assert(invoiceEmail.status === 202 && invoiceEmail.body.delivery.status === "sandboxed", "invoice email sandboxed");

    const count = await adminPool.query("SELECT count(*)::int AS total FROM email_deliveries WHERE tenant_id = $1 AND status = 'sandboxed'", [tenantA]);
    assert(count.rows[0].total >= 2, "email deliveries persisted");

    const emailHistory = await request(port, "tenant-a", "/api/email/deliveries", { method: "GET" });
    assert(emailHistory.status === 200 && emailHistory.body.items.length >= 2, "email history listed by tenant");

    const organizationRepository = createPostgresOrganizationRepository(adminPool);
    const orgContext = {
      tenant: { tenantId: tenantA, companyName: "Smoke Email A" },
      actor: { userId: userA, role: "admin", roles: ["admin"] },
    };
    const access = await organizationRepository.createUser(orgContext, {
      email: "new-worker@example.com",
      displayName: "New Worker",
      role: "worker",
    });
    assert(access.emailDelivery.status === "sandboxed" && access.emailDelivery.templateKey === "user.temporary_access", "user access email sandboxed");
    const reset = await organizationRepository.resetUserPassword(orgContext, access.user.userId, {});
    assert(reset.emailDelivery.status === "sandboxed" && reset.emailDelivery.templateKey === "user.password_reset", "password reset email sandboxed");

    console.log("Email local smoke passed.");
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

async function setupTenant(tenantId, userId, clientId, companyName, email) {
  const client = await adminPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    await client.query("INSERT INTO tenants (tenant_id, name, industry_profile, locale, currency, timezone) VALUES ($1, $2, 'construction', 'en-US', 'USD', 'America/Denver')", [tenantId, companyName]);
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, $3, 'Smoke Admin', 'active')", [userId, tenantId, `admin-${tenantId}@example.com`]);
    for (const role of ["admin", "manager", "worker"]) {
      await client.query("INSERT INTO roles (tenant_id, code, label, scope) VALUES ($1, $2, $3, 'tenant')", [tenantId, role, role]);
    }
    await client.query("INSERT INTO clients (client_id, tenant_id, name, status, email) VALUES ($1, $2, $3, 'active', $4)", [clientId, tenantId, `Client ${companyName}`, email]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
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
  await cleanupTenant(tenantB).catch(() => {});
  await adminPool.end().catch(() => {});
}

async function cleanupTenant(tenantId) {
  const client = await adminPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    for (const table of [
      "email_deliveries",
      "invoice_items",
      "invoices",
      "estimate_items",
      "estimate_sections",
      "estimate_versions",
      "estimates",
      "audit_events",
      "clients",
      "auth_password_credentials",
      "user_roles",
      "users",
      "roles",
    ]) {
      await client.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [tenantId]).catch(() => {});
    }
    await client.query("DELETE FROM tenants WHERE tenant_id = $1", [tenantId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
