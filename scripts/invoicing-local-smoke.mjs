import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createRuntimeServer } from "../server/runtime/server.mjs";
import { createPostgresInvoiceRepositoryFromEnv } from "../server/runtime/postgresInvoiceRepository.mjs";

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

if (!adminDatabaseUrl || !runtimeDatabaseUrl) {
  console.log("Invoicing local smoke skipped: ADMIN_DATABASE_URL and RUNTIME_DATABASE_URL are required.");
  process.exit(0);
}

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const clientA = randomUUID();
const clientB = randomUUID();
const estimateA = randomUUID();
const adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 2 });
const invoiceRepository = createPostgresInvoiceRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
let server;
let address;
let invoiceAId;

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
      INSERT INTO tenants (tenant_id, name, industry_profile, locale, currency, timezone, country_profile, unit_system, document_language)
      VALUES
        ($1, 'Invoicing Tenant A', 'construction', 'es-US', 'USD', 'America/Denver', 'US', 'imperial', 'en'),
        ($2, 'Invoicing Tenant B', 'construction', 'es-US', 'USD', 'America/Denver', 'US', 'imperial', 'en')
    `,
    [tenantA, tenantB],
  );
  await withTenantAdmin(tenantA, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'invoicing-a@local.test', 'Invoicing A', 'active')", [userA, tenantA]);
    await client.query("INSERT INTO clients (client_id, tenant_id, name, status, email) VALUES ($1, $2, 'Cliente factura A', 'active', 'a@example.com')", [clientA, tenantA]);
    await client.query(
      "INSERT INTO estimates (estimate_id, tenant_id, client_id, estimate_number, status, total_amount, currency) VALUES ($1, $2, $3, 'EST-INV-A', 'approved', 240, 'USD')",
      [estimateA, tenantA, clientA],
    );
  });
  await withTenantAdmin(tenantB, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'invoicing-b@local.test', 'Invoicing B', 'active')", [userB, tenantB]);
    await client.query("INSERT INTO clients (client_id, tenant_id, name, status, email) VALUES ($1, $2, 'Cliente factura B', 'active', 'b@example.com')", [clientB, tenantB]);
  });
}

function contextForToken(token) {
  const isB = token === "tenant-b";
  return {
    tenant: { tenantId: isB ? tenantB : tenantA, companyName: isB ? "Invoicing Tenant B" : "Invoicing Tenant A" },
    actor: {
      userId: isB ? userB : userA,
      role: "admin",
      roles: ["admin"],
      capabilities: [
        "invoices.read",
        "invoices.create",
        "invoices.update",
        "invoices.issue",
        "payments.record",
        "invoices.pdf.download",
        "invoices.credit_notes.create",
      ],
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
    invoiceRepository,
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

  const create = await request("tenant-a", "/api/invoicing/invoices", {
    method: "POST",
    body: {
      estimateId: estimateA,
      title: "Factura smoke",
      issueDate: "2026-07-14",
      dueDate: "2026-07-30",
      documentLanguage: "en",
      countryProfile: "US",
    },
  });
  invoiceAId = create.body.invoice?.invoiceId;
  check("Tenant A crea factura desde cotizacion", create.status === 201 && create.body.invoice?.totalAmount === 240, JSON.stringify(create.body));

  const listA = await request("tenant-a", "/api/invoicing/invoices");
  check("Tenant A ve su factura", listA.status === 200 && listA.body.items.some((item) => item.invoiceId === invoiceAId), JSON.stringify(listA.body));

  const listB = await request("tenant-b", "/api/invoicing/invoices");
  check("Tenant B no ve factura A", listB.status === 200 && !listB.body.items.some((item) => item.invoiceId === invoiceAId), JSON.stringify(listB.body));

  const detailB = await request("tenant-b", `/api/invoicing/invoices/${invoiceAId}`);
  check("Tenant B no abre detalle A", detailB.status === 404, JSON.stringify(detailB.body));

  const issue = await request("tenant-a", `/api/invoicing/invoices/${invoiceAId}/issue`, { method: "POST" });
  check("Tenant A emite factura", issue.status === 200 && issue.body.invoice?.status === "issued", JSON.stringify(issue.body));

  const ledgerAfterIssue = await withTenantAdmin(tenantA, (client) =>
    client.query("SELECT count(*)::integer AS total FROM financial_transactions WHERE tenant_id = $1 AND related_entity_id = $2", [tenantA, invoiceAId]),
  );
  check("Factura genera ledger", ledgerAfterIssue.rows[0].total >= 2, JSON.stringify(ledgerAfterIssue.rows[0]));

  const pay = await request("tenant-a", `/api/invoicing/invoices/${invoiceAId}/payments`, {
    method: "POST",
    body: { amount: 240, method: "bank_transfer", reference: "SMOKE-PAY" },
  });
  const paymentAId = pay.body.payment?.paymentId;
  check("Tenant A registra cobro", pay.status === 201 && pay.body.invoice?.status === "paid" && pay.body.invoice?.balanceAmount === 0, JSON.stringify(pay.body));

  const ledgerAfterPay = await withTenantAdmin(tenantA, (client) =>
    client.query("SELECT count(*)::integer AS total FROM financial_transactions WHERE tenant_id = $1 AND related_entity_id = $2", [tenantA, invoiceAId]),
  );
  check("Cobro genera ledger", ledgerAfterPay.rows[0].total >= 4, JSON.stringify(ledgerAfterPay.rows[0]));

  const invoicePdf = await requestPdf("tenant-a", `/api/invoicing/invoices/${invoiceAId}/pdf`);
  check("Factura descarga PDF", invoicePdf.status === 200 && invoicePdf.contentType.includes("application/pdf") && invoicePdf.body.subarray(0, 4).toString() === "%PDF", invoicePdf.contentType);
  const invoicePdfDocument = await withTenantAdmin(tenantA, (client) =>
    client.query(
      "SELECT storage_size_bytes FROM documents WHERE tenant_id = $1 AND related_entity_type = 'invoice' AND related_entity_id = $2 AND document_type = 'invoice_pdf' LIMIT 1",
      [tenantA, invoiceAId],
    ),
  );
  check(
    "Factura PDF registra tamano",
    Number(invoicePdfDocument.rows[0]?.storage_size_bytes) === invoicePdf.body.length,
    JSON.stringify(invoicePdfDocument.rows[0]),
  );

  const receiptPdf = await requestPdf("tenant-a", `/api/invoicing/invoices/${invoiceAId}/payments/${paymentAId}/receipt.pdf`);
  check("Recibo descarga PDF", receiptPdf.status === 200 && receiptPdf.contentType.includes("application/pdf") && receiptPdf.body.subarray(0, 4).toString() === "%PDF", receiptPdf.contentType);
  const receiptPdfDocument = await withTenantAdmin(tenantA, (client) =>
    client.query(
      "SELECT storage_size_bytes FROM documents WHERE tenant_id = $1 AND related_entity_type = 'payment' AND related_entity_id = $2 AND document_type = 'payment_receipt_pdf' LIMIT 1",
      [tenantA, paymentAId],
    ),
  );
  check(
    "Recibo PDF registra tamano",
    Number(receiptPdfDocument.rows[0]?.storage_size_bytes) === receiptPdf.body.length,
    JSON.stringify(receiptPdfDocument.rows[0]),
  );

  const manualInvoice = await request("tenant-a", "/api/invoicing/invoices", {
    method: "POST",
    body: {
      clientId: clientA,
      title: "Factura para rectificar",
      currency: "USD",
      issueDate: "2026-07-14",
      items: [{ description: "Servicio rectificable", quantity: 1, unitPrice: 100 }],
    },
  });
  const manualInvoiceId = manualInvoice.body.invoice?.invoiceId;
  await request("tenant-a", `/api/invoicing/invoices/${manualInvoiceId}/issue`, { method: "POST" });
  const creditNote = await request("tenant-a", `/api/invoicing/invoices/${manualInvoiceId}/credit-notes`, {
    method: "POST",
    body: { amount: 25, reason: "Ajuste acordado smoke" },
  });
  const creditNoteId = creditNote.body.invoice?.invoiceId;
  check("Tenant A crea rectificativa", creditNote.status === 201 && creditNote.body.invoice?.invoiceType === "credit_note" && creditNote.body.invoice?.totalAmount === -25, JSON.stringify(creditNote.body));

  const creditPdf = await requestPdf("tenant-a", `/api/invoicing/invoices/${creditNoteId}/pdf`);
  check("Rectificativa descarga PDF", creditPdf.status === 200 && creditPdf.body.subarray(0, 4).toString() === "%PDF", creditPdf.contentType);

  const creditB = await request("tenant-b", `/api/invoicing/invoices/${manualInvoiceId}/credit-notes`, {
    method: "POST",
    body: { amount: 10, reason: "Cruce prohibido" },
  });
  check("Tenant B no rectifica factura A", creditB.status === 404, JSON.stringify(creditB.body));

  const audit = await withTenantAdmin(tenantA, (client) =>
    client.query("SELECT count(*)::integer AS total FROM audit_events WHERE tenant_id = $1 AND module_id = 'invoicing'", [tenantA]),
  );
  check("Facturacion genera auditoria", audit.rows[0].total >= 3, JSON.stringify(audit.rows[0]));
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await invoiceRepository?.close?.();
  for (const tenantId of [tenantA, tenantB]) {
    await withTenantAdmin(tenantId, async (client) => {
      await client.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM financial_transactions WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM financial_accounts WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM receipts WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM payments WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM invoice_status_history WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM invoice_items WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM invoices WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM document_links WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM document_versions WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM documents WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM estimate_approvals WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM estimate_items WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM estimate_sections WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM estimate_versions WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM estimates WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM clients WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
    }).catch(() => {});
  }
  await adminPool.query("DELETE FROM tenants WHERE tenant_id = ANY($1::uuid[])", [[tenantA, tenantB]]).catch(() => {});
  await adminPool.end();
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Invoicing local smoke failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Invoicing local smoke passed with ${checks.length} checks.`);
