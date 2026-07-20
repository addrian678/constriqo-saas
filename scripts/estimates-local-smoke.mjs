import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createRuntimeServer } from "../server/runtime/server.mjs";
import { createPostgresEstimateRepositoryFromEnv } from "../server/runtime/postgresEstimateRepository.mjs";

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

if (!adminDatabaseUrl || !runtimeDatabaseUrl) {
  console.log("Estimates local smoke skipped: ADMIN_DATABASE_URL and RUNTIME_DATABASE_URL are required.");
  process.exit(0);
}

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const clientA = randomUUID();
const clientB = randomUUID();
const adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 2 });
const estimateRepository = createPostgresEstimateRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
let server;
let address;
let estimateAId;

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
        ($1, 'Estimates Smoke Tenant A', 'construction', 'es-US', 'EUR', 'Europe/Berlin'),
        ($2, 'Estimates Smoke Tenant B', 'construction', 'es-US', 'EUR', 'Europe/Berlin')
    `,
    [tenantA, tenantB],
  );
  await withTenantAdmin(tenantA, async (client) => {
    await client.query(
      "INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, $3, $4, 'active')",
      [userA, tenantA, "estimates-smoke-a@local.test", "Estimates Smoke A"],
    );
    await client.query(
      "INSERT INTO clients (client_id, tenant_id, name, status, email) VALUES ($1, $2, 'Cliente estimate A', 'active', 'a@example.com')",
      [clientA, tenantA],
    );
  });
  await withTenantAdmin(tenantB, async (client) => {
    await client.query(
      "INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, $3, $4, 'active')",
      [userB, tenantB, "estimates-smoke-b@local.test", "Estimates Smoke B"],
    );
    await client.query(
      "INSERT INTO clients (client_id, tenant_id, name, status, email) VALUES ($1, $2, 'Cliente estimate B', 'active', 'b@example.com')",
      [clientB, tenantB],
    );
  });
}

function contextForToken(token) {
  const isB = token === "tenant-b";
  return {
    tenant: { tenantId: isB ? tenantB : tenantA, companyName: isB ? "Estimates Smoke Tenant B" : "Estimates Smoke Tenant A" },
    actor: {
      userId: isB ? userB : userA,
      role: "admin",
      roles: ["admin"],
      capabilities: ["estimates.read", "estimates.create", "estimates.update", "estimates.approve", "estimates.pdf.download"],
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

async function requestPdf(token, path) {
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    body: Buffer.from(await response.arrayBuffer()),
  };
}

try {
  await setupFixtures();
  server = createRuntimeServer({
    estimateRepository,
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

  const create = await request("tenant-a", "/api/estimates", {
    method: "POST",
    body: {
      clientId: clientA,
      title: "Presupuesto temporal smoke",
      scope: "Alcance temporal",
      taxRate: 21,
      sections: [
        {
          title: "General",
          items: [
            { description: "Servicio A", quantity: 2, unitPrice: 100 },
            { description: "Servicio B", quantity: 1, unitPrice: 50 },
          ],
        },
      ],
    },
  });
  estimateAId = create.body.estimate?.estimateId;
  check("Tenant A crea cotizacion", create.status === 201 && Boolean(estimateAId), JSON.stringify(create.body));
  check("Totales se calculan con impuesto", create.body.estimate?.totalAmount === 302.5, JSON.stringify(create.body.estimate));

  const listA = await request("tenant-a", "/api/estimates");
  check("Tenant A ve su cotizacion", listA.status === 200 && listA.body.items.some((item) => item.estimateId === estimateAId), JSON.stringify(listA.body));

  const listB = await request("tenant-b", "/api/estimates");
  check("Tenant B no ve cotizacion de tenant A", listB.status === 200 && !listB.body.items.some((item) => item.estimateId === estimateAId), JSON.stringify(listB.body));

  const detailB = await request("tenant-b", `/api/estimates/${estimateAId}`);
  check("Tenant B no lee detalle de tenant A", detailB.status === 404, JSON.stringify(detailB.body));

  const approveB = await request("tenant-b", `/api/estimates/${estimateAId}/approve`, { method: "POST", body: {} });
  check("Tenant B no aprueba cotizacion de tenant A", approveB.status === 404, JSON.stringify(approveB.body));

  const detailA = await request("tenant-a", `/api/estimates/${estimateAId}`);
  check("Tenant A lee detalle con partidas", detailA.status === 200 && detailA.body.sections[0]?.items?.length === 2, JSON.stringify(detailA.body));

  const approveA = await request("tenant-a", `/api/estimates/${estimateAId}/approve`, { method: "POST", body: { note: "Aprobada smoke" } });
  check("Tenant A aprueba cotizacion", approveA.status === 201 && approveA.body.approval?.status === "approved", JSON.stringify(approveA.body));

  const estimatePdf = await requestPdf("tenant-a", `/api/estimates/${estimateAId}/pdf`);
  check("Tenant A descarga PDF cotizacion", estimatePdf.status === 200 && estimatePdf.contentType.includes("application/pdf") && estimatePdf.body.subarray(0, 4).toString() === "%PDF", estimatePdf.contentType);

  const archivedPdf = await withTenantAdmin(tenantA, (client) =>
    client.query(
      `
        SELECT d.document_id, d.storage_size_bytes
        FROM documents d
        JOIN document_links dl ON dl.tenant_id = d.tenant_id AND dl.document_id = d.document_id
        WHERE d.tenant_id = $1
          AND dl.related_entity_type = 'estimate'
          AND dl.related_entity_id = $2
          AND d.document_type = 'estimate_pdf'
        LIMIT 1
      `,
      [tenantA, estimateAId],
    ),
  );
  check(
    "PDF cotizacion queda archivado con tamano",
    Number(archivedPdf.rows[0]?.storage_size_bytes) === estimatePdf.body.length,
    JSON.stringify(archivedPdf.rows[0]),
  );

  const auditCount = await withTenantAdmin(tenantA, (client) =>
    client.query("SELECT count(*)::integer AS total FROM audit_events WHERE tenant_id = $1 AND module_id = 'estimates'", [tenantA]),
  );
  check("Operaciones estimates generan auditoria", auditCount.rows[0].total >= 2, JSON.stringify(auditCount.rows[0]));
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await estimateRepository?.close?.();
  for (const tenantId of [tenantA, tenantB]) {
    await withTenantAdmin(tenantId, async (client) => {
      await client.query("DELETE FROM estimate_approvals WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM document_links WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM document_versions WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM documents WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM estimate_items WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM estimate_sections WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM estimate_versions WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM estimates WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM clients WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
    }).catch(() => {});
  }
  await adminPool.query("DELETE FROM tenants WHERE tenant_id = ANY($1::uuid[])", [[tenantA, tenantB]]).catch(() => {});
  await adminPool.end();
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Estimates local smoke failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Estimates local smoke passed with ${checks.length} checks.`);
