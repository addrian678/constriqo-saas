import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createRuntimeServer } from "../server/runtime/server.mjs";
import { createPostgresFinanceRepositoryFromEnv } from "../server/runtime/postgresFinanceRepository.mjs";

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

if (!adminDatabaseUrl || !runtimeDatabaseUrl) {
  console.log("Finance local smoke skipped: ADMIN_DATABASE_URL and RUNTIME_DATABASE_URL are required.");
  process.exit(0);
}

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 2 });
const financeRepository = createPostgresFinanceRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
let server;
let address;
let expenseAId;

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
        ($1, 'Finance Tenant A', 'construction', 'es-US', 'USD', 'America/Denver'),
        ($2, 'Finance Tenant B', 'construction', 'es-US', 'USD', 'America/Denver')
    `,
    [tenantA, tenantB],
  );
  await withTenantAdmin(tenantA, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'finance-a@local.test', 'Finance A', 'active')", [userA, tenantA]);
  });
  await withTenantAdmin(tenantB, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'finance-b@local.test', 'Finance B', 'active')", [userB, tenantB]);
  });
}

function contextForToken(token) {
  const isB = token === "tenant-b";
  return {
    tenant: { tenantId: isB ? tenantB : tenantA, companyName: isB ? "Finance Tenant B" : "Finance Tenant A" },
    actor: {
      userId: isB ? userB : userA,
      role: "admin",
      roles: ["admin"],
      capabilities: ["expenses.read", "expenses.create", "expenses.approve", "finance.read", "cashflow.read", "finance.manage"],
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
    financeRepository,
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

  const vendor = await request("tenant-a", "/api/expenses/vendors", {
    method: "POST",
    body: { name: "Proveedor smoke", category: "Materiales", phone: "555-0101" },
  });
  check("Tenant A crea proveedor", vendor.status === 201 && vendor.body.vendor?.vendorId, JSON.stringify(vendor.body));

  const expense = await request("tenant-a", "/api/expenses", {
    method: "POST",
    body: {
      vendorId: vendor.body.vendor.vendorId,
      vendorName: vendor.body.vendor.name,
      category: "Materiales",
      description: "Compra temporal smoke",
      currency: "USD",
      totalAmount: 125.5,
      taxAmount: 8.25,
      issueDate: "2026-07-14",
      dueDate: "2026-07-30",
    },
  });
  expenseAId = expense.body.expense?.expenseId;
  check("Tenant A crea gasto", expense.status === 201 && expense.body.expense?.totalAmount === 125.5, JSON.stringify(expense.body));

  const ledger = await request("tenant-a", "/api/finance/transactions");
  check("Gasto genera ledger", ledger.status === 200 && ledger.body.items.filter((item) => item.relatedEntityId === expenseAId).length >= 2, JSON.stringify(ledger.body));

  const dashboard = await request("tenant-a", "/api/finance/dashboard");
  check("Dashboard refleja egreso", dashboard.status === 200 && dashboard.body.dashboard?.summary?.expenses >= 125.5, JSON.stringify(dashboard.body));

  const manual = await request("tenant-a", "/api/finance/transactions", {
    method: "POST",
    body: {
      accountType: "income",
      transactionType: "income",
      direction: "credit",
      amount: 300,
      currency: "USD",
      description: "Ingreso manual smoke",
    },
  });
  const manualTransactionId = manual.body.transaction?.transactionId;
  check("Tenant A crea movimiento manual", manual.status === 201 && manualTransactionId, JSON.stringify(manual.body));

  const correction = await request("tenant-a", `/api/finance/transactions/${manualTransactionId}/correct`, {
    method: "POST",
    body: {
      accountType: "income",
      transactionType: "income",
      direction: "credit",
      amount: 325,
      currency: "USD",
      description: "Ingreso manual corregido smoke",
    },
  });
  check(
    "Movimiento manual se corrige con reverso",
    correction.status === 201 && correction.body.reversal?.reversedTransactionId === manualTransactionId && correction.body.correction?.amount === 325,
    JSON.stringify(correction.body),
  );

  const correctedLedger = await request("tenant-a", "/api/finance/transactions");
  const originalAfterCorrection = correctedLedger.body.items?.find((item) => item.transactionId === manualTransactionId);
  check("Original queda marcado corregido", correctedLedger.status === 200 && originalAfterCorrection?.status === "corrected", JSON.stringify(originalAfterCorrection));

  const listB = await request("tenant-b", "/api/expenses");
  check("Tenant B no ve gasto A", listB.status === 200 && !listB.body.items.some((item) => item.expenseId === expenseAId), JSON.stringify(listB.body));

  const approve = await request("tenant-a", `/api/expenses/${expenseAId}/approve`, { method: "POST" });
  check("Tenant A aprueba gasto", approve.status === 200 && approve.body.expense?.status === "approved", JSON.stringify(approve.body));

  const pay = await request("tenant-a", `/api/expenses/${expenseAId}/payments`, {
    method: "POST",
    body: { amount: 125.5, method: "cash" },
  });
  check("Tenant A registra pago", pay.status === 200 && pay.body.expense?.status === "paid" && pay.body.expense?.balanceAmount === 0, JSON.stringify(pay.body));

  const audit = await withTenantAdmin(tenantA, (client) =>
    client.query("SELECT count(*)::integer AS total FROM audit_events WHERE tenant_id = $1 AND module_id = 'finance'", [tenantA]),
  );
  check("Finanzas genera auditoria", audit.rows[0].total >= 3, JSON.stringify(audit.rows[0]));
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await financeRepository?.close?.();
  for (const tenantId of [tenantA, tenantB]) {
    await withTenantAdmin(tenantId, async (client) => {
      await client.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM financial_transactions WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM financial_reconciliations WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM financial_accounts WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM expense_status_history WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM expense_payments WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM expense_items WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM expenses WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM vendors WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
    }).catch(() => {});
  }
  await adminPool.query("DELETE FROM tenants WHERE tenant_id = ANY($1::uuid[])", [[tenantA, tenantB]]).catch(() => {});
  await adminPool.end();
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Finance local smoke failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Finance local smoke passed with ${checks.length} checks.`);
