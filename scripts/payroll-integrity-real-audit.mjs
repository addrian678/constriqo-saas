import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL or MIGRATION_DATABASE_URL is required.");
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : false,
});

let failures = 0;

function check(name, passed, details = "") {
  if (passed) {
    console.log(`ok - ${name}`);
    return;
  }
  failures += 1;
  console.error(`not ok - ${name}${details ? ` (${details})` : ""}`);
}

async function scalar(sql, params = []) {
  const result = await client.query(sql, params);
  const firstRow = result.rows[0] || {};
  return Number(Object.values(firstRow)[0] || 0);
}

try {
  await client.connect();

  const rls = await client.query(
    `
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND relname IN ('payroll_worker_settings', 'payroll_payments', 'payroll_payment_time_entries')
      ORDER BY relname
    `,
  );
  check("Payroll RLS enabled and forced on all tables", rls.rows.length === 3 && rls.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity));

  const workerPayrollCapabilities = await scalar(
    `
      SELECT count(*)
      FROM roles r
      JOIN role_capabilities rc ON rc.role_id = r.role_id
      JOIN capabilities c ON c.capability_id = rc.capability_id
      WHERE r.code = 'worker'
        AND c.code LIKE 'payroll.%'
    `,
  );
  check("Worker role has no payroll capabilities", workerPayrollCapabilities === 0, `${workerPayrollCapabilities} worker payroll grants`);

  const managerManagePayroll = await scalar(
    `
      SELECT count(*)
      FROM roles r
      JOIN role_capabilities rc ON rc.role_id = r.role_id
      JOIN capabilities c ON c.capability_id = rc.capability_id
      WHERE r.code = 'manager'
        AND c.code = 'payroll.manage'
    `,
  );
  check("Manager cannot manage payroll payments", managerManagePayroll === 0, `${managerManagePayroll} manager manage grants`);

  const paidWithoutPayment = await scalar(
    "SELECT count(*) FROM time_entries WHERE payroll_status = 'paid' AND payroll_payment_id IS NULL",
  );
  check("No paid time entry is missing payroll payment id", paidWithoutPayment === 0, `${paidWithoutPayment} entries`);

  const cancelledNotExcluded = await scalar(
    "SELECT count(*) FROM time_entries WHERE status = 'cancelled' AND payroll_status != 'excluded'",
  );
  check("Cancelled entries are excluded from payroll", cancelledNotExcluded === 0, `${cancelledNotExcluded} entries`);

  const paymentWithoutFinance = await scalar(
    "SELECT count(*) FROM payroll_payments WHERE finance_transaction_id IS NULL",
  );
  check("Payroll payments are linked to finance transactions", paymentWithoutFinance === 0, `${paymentWithoutFinance} payments`);

  const crossTenantFinance = await scalar(
    `
      SELECT count(*)
      FROM payroll_payments pp
      JOIN financial_transactions ft
        ON ft.financial_transaction_id = pp.finance_transaction_id
       AND ft.tenant_id != pp.tenant_id
    `,
  );
  check("Payroll finance links do not cross tenants", crossTenantFinance === 0, `${crossTenantFinance} cross-tenant links`);

  const orphanPaymentEntries = await scalar(
    `
      SELECT count(*)
      FROM payroll_payment_time_entries ppte
      LEFT JOIN payroll_payments pp
        ON pp.tenant_id = ppte.tenant_id
       AND pp.payroll_payment_id = ppte.payroll_payment_id
      LEFT JOIN time_entries te
        ON te.tenant_id = ppte.tenant_id
       AND te.time_entry_id = ppte.time_entry_id
      WHERE pp.payroll_payment_id IS NULL
         OR te.time_entry_id IS NULL
    `,
  );
  check("Payroll payment entry links are not orphaned", orphanPaymentEntries === 0, `${orphanPaymentEntries} orphan links`);

  const duplicatePaidEntries = await scalar(
    `
      SELECT count(*)
      FROM (
        SELECT tenant_id, time_entry_id
        FROM payroll_payment_time_entries
        GROUP BY tenant_id, time_entry_id
        HAVING count(*) > 1
      ) duplicated
    `,
  );
  check("No time entry appears in more than one payroll payment", duplicatePaidEntries === 0, `${duplicatePaidEntries} duplicated entries`);

  const uniquePaymentEntryConstraint = await scalar(
    `
      SELECT count(*)
      FROM pg_constraint
      WHERE conname = 'uq_payroll_payment_entries_tenant_time_entry'
    `,
  );
  check("Database enforces one payroll payment per time entry", uniquePaymentEntryConstraint === 1, `${uniquePaymentEntryConstraint} constraints`);

  const negativeCalculatedEntries = await scalar(
    `
      SELECT count(*)
      FROM payroll_payment_time_entries
      WHERE gross_seconds < 0
         OR break_seconds < 0
         OR payable_seconds < 0
         OR payable_seconds > gross_seconds
    `,
  );
  check("Payroll entry seconds are mathematically valid", negativeCalculatedEntries === 0, `${negativeCalculatedEntries} invalid entries`);

  if (failures > 0) {
    console.error(`Payroll integrity real audit failed with ${failures} issue(s).`);
    process.exit(1);
  }

  console.log("Payroll integrity real audit passed.");
} finally {
  await client.end().catch(() => {});
}
