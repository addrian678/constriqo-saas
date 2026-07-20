import { randomUUID } from "node:crypto";
import { createPostgresPoolFromEnv } from "./postgresAuthRepository.mjs";
import { nextDocumentSequence } from "./documentSequences.mjs";

const CURRENCIES = new Set(["USD", "COP", "EUR"]);
const EXPENSE_STATUSES = new Set(["draft", "registered", "approved", "paid", "void"]);
const VENDOR_STATUSES = new Set(["active", "inactive"]);
const ACCOUNT_TYPES = new Set(["cash", "bank", "receivable", "payable", "income", "expense", "asset", "liability", "equity"]);

const DEFAULT_ACCOUNTS = [
  ["Caja", "cash"],
  ["Banco", "bank"],
  ["Cuentas por cobrar", "receivable"],
  ["Cuentas por pagar", "payable"],
  ["Ingresos", "income"],
  ["Gastos", "expense"],
  ["Activos", "asset"],
  ["Pasivos", "liability"],
  ["Patrimonio", "equity"],
];

export function createPostgresFinanceRepositoryFromEnv(env = process.env) {
  const pool = createPostgresPoolFromEnv(env);
  if (!pool) {
    return null;
  }

  return {
    ...createPostgresFinanceRepository(pool),
    async close() {
      await pool.end();
    },
  };
}

export function createPostgresFinanceRepository(pool) {
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

  async function listVendors(context) {
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          SELECT vendor_id, name, category, contact_name, phone, email, status, created_at, updated_at
          FROM vendors
          WHERE tenant_id = $1
          ORDER BY updated_at DESC, name ASC
          LIMIT 150
        `,
        [context.tenant.tenantId],
      );
      return { items: result.rows.map(mapVendor), total: result.rowCount };
    });
  }

  async function createVendor(context, input = {}) {
    const clean = validateVendorInput(input);
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          INSERT INTO vendors (tenant_id, name, category, contact_name, phone, email, status)
          VALUES ($1, $2, $3, $4, $5, $6, 'active')
          ON CONFLICT (tenant_id, name) DO UPDATE
          SET category = EXCLUDED.category,
              contact_name = EXCLUDED.contact_name,
              phone = EXCLUDED.phone,
              email = EXCLUDED.email,
              status = 'active',
              updated_at = now()
          RETURNING vendor_id, name, category, contact_name, phone, email, status, created_at, updated_at
        `,
        [context.tenant.tenantId, clean.name, clean.category, clean.contactName, clean.phone, clean.email],
      );
      await writeAudit(client, context, "expenses.vendor.upserted", "vendor", result.rows[0].vendor_id, { name: clean.name });
      return mapVendor(result.rows[0]);
    });
  }

  async function listExpenses(context, filters = {}) {
    return queryForTenant(context, async (client) => {
      const params = [context.tenant.tenantId];
      const where = ["e.tenant_id = $1"];
      if (filters.status && EXPENSE_STATUSES.has(filters.status)) {
        params.push(filters.status);
        where.push(`e.status = $${params.length}`);
      }
      const result = await client.query(
        `
          SELECT e.expense_id, e.expense_number, e.job_id, j.job_number, j.title AS job_title,
                 e.vendor_id, COALESCE(v.name, e.vendor_name) AS vendor_name,
                 e.vendor_name AS raw_vendor_name, e.category, e.description, e.status,
                 e.total_amount, e.balance_amount, e.tax_amount, e.currency, e.issue_date, e.due_date,
                 e.approved_by_user_id, e.approved_at, e.created_at, e.updated_at
          FROM expenses e
          LEFT JOIN vendors v ON v.tenant_id = e.tenant_id AND v.vendor_id = e.vendor_id
          LEFT JOIN jobs j ON j.tenant_id = e.tenant_id AND j.job_id = e.job_id
          WHERE ${where.join(" AND ")}
          ORDER BY COALESCE(e.issue_date, e.created_at::date) DESC, e.created_at DESC
          LIMIT 150
        `,
        params,
      );
      const summary = await summarizeExpenses(client, context.tenant.tenantId);
      return { items: result.rows.map(mapExpense), total: result.rowCount, summary };
    });
  }

  async function createExpense(context, input = {}) {
    const clean = validateExpenseInput(input);
    return queryForTenant(context, async (client) => {
      await ensureDefaultAccounts(client, context.tenant.tenantId, clean.currency);
      if (clean.jobId) {
        await requireJobForTenant(client, context.tenant.tenantId, clean.jobId);
      }
      const vendor = clean.vendorId
        ? await requireVendorForTenant(client, context.tenant.tenantId, clean.vendorId)
        : await upsertVendorByName(client, context, clean.vendorName);
      const expenseNumber = clean.expenseNumber || (await generateExpenseNumber(client, context.tenant.tenantId));
      const result = await client.query(
        `
          INSERT INTO expenses (
            tenant_id, job_id, vendor_id, vendor_name, expense_number, category, description,
            status, total_amount, balance_amount, tax_amount, currency, issue_date, due_date
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'registered', $8, $8, $9, $10, $11, $12)
          RETURNING expense_id
        `,
        [
          context.tenant.tenantId,
          clean.jobId,
          vendor.vendor_id,
          vendor.name,
          expenseNumber,
          clean.category,
          clean.description,
          clean.totalAmount,
          clean.taxAmount,
          clean.currency,
          clean.issueDate,
          clean.dueDate,
        ],
      );
      const expenseId = result.rows[0].expense_id;
      await client.query(
        `
          INSERT INTO expense_items (tenant_id, expense_id, description, quantity, amount, tax_amount, total_amount)
          VALUES ($1, $2, $3, 1, $4, $5, $4)
        `,
        [context.tenant.tenantId, expenseId, clean.description || clean.category, clean.totalAmount, clean.taxAmount],
      );
      await postExpenseLedger(client, context, {
        expenseId,
        amount: clean.totalAmount,
        currency: clean.currency,
        occurredAt: clean.issueDate,
        description: `Gasto ${expenseNumber} - ${vendor.name}`,
      });
      await writeAudit(client, context, "expenses.created", "expense", expenseId, {
        expenseNumber,
        amount: clean.totalAmount,
        vendorId: vendor.vendor_id,
      });
      return getExpenseById(client, context.tenant.tenantId, expenseId);
    });
  }

  async function approveExpense(context, expenseId) {
    return queryForTenant(context, async (client) => {
      const existing = await requireExpenseForTenant(client, context.tenant.tenantId, expenseId);
      if (existing.status === "void") {
        validationError("No se puede aprobar un gasto anulado.");
      }
      await client.query(
        `
          UPDATE expenses
          SET status = 'approved',
              approved_by_user_id = $3,
              approved_at = now(),
              updated_at = now()
          WHERE tenant_id = $1 AND expense_id = $2
        `,
        [context.tenant.tenantId, expenseId, context.actor.userId],
      );
      await client.query(
        `
          INSERT INTO expense_status_history (tenant_id, expense_id, from_status, to_status, changed_by_user_id)
          VALUES ($1, $2, $3, 'approved', $4)
        `,
        [context.tenant.tenantId, expenseId, existing.status, context.actor.userId],
      );
      await writeAudit(client, context, "expenses.approved", "expense", expenseId, { fromStatus: existing.status });
      return getExpenseById(client, context.tenant.tenantId, expenseId);
    });
  }

  async function recordExpensePayment(context, expenseId, input = {}) {
    const clean = validateExpensePaymentInput(input);
    return queryForTenant(context, async (client) => {
      const existing = await requireExpenseForTenant(client, context.tenant.tenantId, expenseId);
      if (existing.status === "void") {
        validationError("No se puede pagar un gasto anulado.");
      }
      const amount = Math.min(clean.amount, Number(existing.balance_amount || 0));
      if (amount <= 0) {
        validationError("El gasto no tiene saldo pendiente.");
      }
      await client.query(
        `
          INSERT INTO expense_payments (tenant_id, expense_id, amount, method, status, paid_at, recorded_by_user_id)
          VALUES ($1, $2, $3, $4, 'recorded', $5, $6)
        `,
        [context.tenant.tenantId, expenseId, amount, clean.method, clean.paidAt, context.actor.userId],
      );
      const nextBalance = Number(existing.balance_amount || 0) - amount;
      await client.query(
        `
          UPDATE expenses
          SET balance_amount = $3::numeric,
              status = CASE WHEN $3::numeric <= 0 THEN 'paid' ELSE status END,
              updated_at = now()
          WHERE tenant_id = $1 AND expense_id = $2
        `,
        [context.tenant.tenantId, expenseId, nextBalance],
      );
      await postCashLedger(client, context, {
        amount,
        currency: existing.currency,
        occurredAt: clean.paidAt,
        relatedEntityType: "expense_payment",
        relatedEntityId: expenseId,
        description: `Pago gasto ${existing.expense_number}`,
      });
      await writeAudit(client, context, "expenses.payment.recorded", "expense", expenseId, { amount, method: clean.method });
      return getExpenseById(client, context.tenant.tenantId, expenseId);
    });
  }

  async function listAccounts(context) {
    return queryForTenant(context, async (client) => {
      const settings = await getTenantSettings(client, context.tenant.tenantId);
      await ensureDefaultAccounts(client, context.tenant.tenantId, settings.currency);
      const result = await client.query(
        `
          SELECT financial_account_id, name, account_type, currency, status, created_at, updated_at
          FROM financial_accounts
          WHERE tenant_id = $1
          ORDER BY account_type, name
        `,
        [context.tenant.tenantId],
      );
      return { items: result.rows.map(mapAccount), total: result.rowCount };
    });
  }

  async function listTransactions(context) {
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          SELECT ft.financial_transaction_id, ft.financial_account_id, fa.name AS account_name,
                 ft.transaction_type, ft.direction, ft.amount, ft.currency, ft.description,
                 ft.related_entity_type, ft.related_entity_id, ft.status, ft.occurred_at, ft.created_at
          FROM financial_transactions ft
          JOIN financial_accounts fa ON fa.tenant_id = ft.tenant_id AND fa.financial_account_id = ft.financial_account_id
          WHERE ft.tenant_id = $1
          ORDER BY ft.occurred_at DESC, ft.created_at DESC
          LIMIT 150
        `,
        [context.tenant.tenantId],
      );
      return { items: result.rows.map(mapTransaction), total: result.rowCount };
    });
  }

  async function createManualTransaction(context, input = {}) {
    const clean = validateManualTransactionInput(input);
    return queryForTenant(context, async (client) => {
      const accountId = clean.accountId || (await accountIdByType(client, context.tenant.tenantId, clean.accountType, clean.currency));
      await requireAccountForTenant(client, context.tenant.tenantId, accountId);
      await insertTransaction(client, context, accountId, {
        transactionType: clean.transactionType,
        direction: clean.direction,
        amount: clean.amount,
        currency: clean.currency,
        relatedEntityType: "manual",
        relatedEntityId: null,
        occurredAt: clean.occurredAt,
        description: clean.description,
      });
      await writeAudit(client, context, "finance.transaction.created", "financial_transaction", accountId, {
        amount: clean.amount,
        direction: clean.direction,
      });
      const transactions = await latestTransactions(client, context.tenant.tenantId);
      return transactions[0];
    });
  }

  async function correctManualTransaction(context, transactionId, input = {}) {
    const clean = validateManualTransactionInput(input);
    return queryForTenant(context, async (client) => {
      const original = await requireTransactionForTenant(client, context.tenant.tenantId, transactionId);
      if (original.status === "corrected") {
        validationError("Este movimiento ya fue corregido. Crea una nueva correccion sobre el movimiento vigente.");
      }
      if (original.related_entity_type && original.related_entity_type !== "manual" && original.related_entity_type !== "financial_correction") {
        validationError("Solo los movimientos manuales pueden corregirse desde finanzas. Usa el modulo origen para facturas, pagos o gastos.");
      }
      const accountId = clean.accountId || (await accountIdByType(client, context.tenant.tenantId, clean.accountType, clean.currency));
      await requireAccountForTenant(client, context.tenant.tenantId, accountId);
      const correctionGroupId = randomUUID();
      const reversalId = await insertTransaction(client, context, original.financial_account_id, {
        transactionType: `${original.transaction_type}_reversal`.slice(0, 80),
        direction: oppositeDirection(original.direction),
        amount: Number(original.amount || 0),
        currency: original.currency,
        relatedEntityType: "financial_correction",
        relatedEntityId: original.financial_transaction_id,
        occurredAt: new Date().toISOString(),
        description: `Reverso por correccion: ${original.description || original.transaction_type}`,
        correctionGroupId,
        reversedTransactionId: original.financial_transaction_id,
      });
      const correctedId = await insertTransaction(client, context, accountId, {
        transactionType: clean.transactionType,
        direction: clean.direction,
        amount: clean.amount,
        currency: clean.currency,
        relatedEntityType: "financial_correction",
        relatedEntityId: original.financial_transaction_id,
        occurredAt: clean.occurredAt,
        description: clean.description,
        correctionGroupId,
        reversedTransactionId: original.financial_transaction_id,
      });
      await client.query(
        `
          UPDATE financial_transactions
          SET status = 'corrected',
              corrected_by_transaction_id = $3,
              correction_group_id = $4
          WHERE tenant_id = $1 AND financial_transaction_id = $2
        `,
        [context.tenant.tenantId, original.financial_transaction_id, correctedId, correctionGroupId],
      );
      await writeAudit(client, context, "finance.transaction.corrected", "financial_transaction", original.financial_transaction_id, {
        reversalId,
        correctedId,
        amount: clean.amount,
      });
      const transactions = await latestTransactions(client, context.tenant.tenantId);
      return {
        original: mapTransaction({ ...original, status: "corrected", corrected_by_transaction_id: correctedId, correction_group_id: correctionGroupId }),
        reversal: transactions.find((item) => item.transactionId === reversalId) || null,
        correction: transactions.find((item) => item.transactionId === correctedId) || null,
      };
    });
  }

  async function getDashboard(context) {
    return queryForTenant(context, async (client) => {
      const settings = await getTenantSettings(client, context.tenant.tenantId);
      await ensureDefaultAccounts(client, context.tenant.tenantId, settings.currency);
      const income = await sumInvoices(client, context.tenant.tenantId);
      const expenses = await summarizeExpenses(client, context.tenant.tenantId);
      const assets = await sumTable(client, context.tenant.tenantId, "assets", "book_value");
      const liabilities = await sumTable(client, context.tenant.tenantId, "liabilities", "balance_amount");
      const ledgerAssets = await accountBalanceByType(client, context.tenant.tenantId, "asset");
      const ledgerLiabilities = await accountBalanceByType(client, context.tenant.tenantId, "liability");
      const receivables = await sumTable(client, context.tenant.tenantId, "invoices", "balance_amount");
      const payables = await sumTable(client, context.tenant.tenantId, "expenses", "balance_amount");
      const transactions = await latestTransactions(client, context.tenant.tenantId);
      const jobProfitability = await calculateJobProfitability(client, context.tenant.tenantId);
      const currentPeriods = {
        today: await periodSummary(client, context.tenant.tenantId, "day"),
        week: await periodSummary(client, context.tenant.tenantId, "week"),
        month: await periodSummary(client, context.tenant.tenantId, "month"),
        year: await periodSummary(client, context.tenant.tenantId, "year"),
      };
      const monthlyHistory = await monthlyPeriodHistory(client, context.tenant.tenantId);
      const totalIncome = Number(income.total || 0);
      const totalExpenses = Number(expenses.total || 0);
      const totalAssets = Number(assets || 0) + Number(receivables || 0) + ledgerAssets;
      const totalLiabilities = Number(liabilities || 0) + Number(payables || 0) + ledgerLiabilities;
      return {
        currency: settings.currency,
        summary: {
          income: currentPeriods.month.income,
          expenses: currentPeriods.month.expenses,
          netProfit: currentPeriods.month.netProfit,
          receivables: Number(receivables || 0),
          payables: Number(payables || 0),
          assets: totalAssets,
          liabilities: totalLiabilities,
          equity: totalAssets - totalLiabilities,
          accumulatedIncome: totalIncome,
          accumulatedExpenses: totalExpenses,
          accumulatedNetProfit: totalIncome - totalExpenses,
        },
        periods: currentPeriods,
        monthlyHistory,
        transactions,
        jobProfitability,
      };
    });
  }

  return {
    listVendors,
    createVendor,
    listExpenses,
    createExpense,
    approveExpense,
    recordExpensePayment,
    listAccounts,
    listTransactions,
    createManualTransaction,
    correctManualTransaction,
    getDashboard,
  };
}

async function getTenantSettings(client, tenantId) {
  const result = await client.query("SELECT currency FROM tenants WHERE tenant_id = $1", [tenantId]);
  return { currency: result.rows[0]?.currency || "USD" };
}

async function ensureDefaultAccounts(client, tenantId, currency) {
  for (const [name, accountType] of DEFAULT_ACCOUNTS) {
    await client.query(
      `
        INSERT INTO financial_accounts (tenant_id, name, account_type, currency, status)
        VALUES ($1, $2, $3, $4, 'active')
        ON CONFLICT (tenant_id, name) DO NOTHING
      `,
      [tenantId, name, accountType, currency],
    );
  }
}

async function accountIdByType(client, tenantId, accountType, currency) {
  await ensureDefaultAccounts(client, tenantId, currency);
  const result = await client.query(
    "SELECT financial_account_id FROM financial_accounts WHERE tenant_id = $1 AND account_type = $2 ORDER BY created_at LIMIT 1",
    [tenantId, accountType],
  );
  if (!result.rows[0]) {
    validationError(`Cuenta financiera no encontrada: ${accountType}.`);
  }
  return result.rows[0].financial_account_id;
}

async function postExpenseLedger(client, context, input) {
  const expenseAccountId = await accountIdByType(client, context.tenant.tenantId, "expense", input.currency);
  const payableAccountId = await accountIdByType(client, context.tenant.tenantId, "payable", input.currency);
  await insertTransaction(client, context, expenseAccountId, {
    transactionType: "expense_accrual",
    direction: "debit",
    amount: input.amount,
    currency: input.currency,
    relatedEntityType: "expense",
    relatedEntityId: input.expenseId,
    occurredAt: input.occurredAt,
    description: input.description,
  });
  await insertTransaction(client, context, payableAccountId, {
    transactionType: "expense_payable",
    direction: "credit",
    amount: input.amount,
    currency: input.currency,
    relatedEntityType: "expense",
    relatedEntityId: input.expenseId,
    occurredAt: input.occurredAt,
    description: input.description,
  });
}

async function postCashLedger(client, context, input) {
  const cashAccountId = await accountIdByType(client, context.tenant.tenantId, "cash", input.currency);
  await insertTransaction(client, context, cashAccountId, {
    transactionType: "cash_out",
    direction: "credit",
    amount: input.amount,
    currency: input.currency,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    occurredAt: input.occurredAt,
    description: input.description,
  });
}

async function insertTransaction(client, context, accountId, input) {
  const result = await client.query(
    `
      INSERT INTO financial_transactions (
        tenant_id, financial_account_id, transaction_type, direction, amount, currency,
        related_entity_type, related_entity_id, occurred_at, created_by_user_id, description, status,
        correction_group_id, reversed_transaction_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10, $11, 'posted', $12, $13)
      RETURNING financial_transaction_id
    `,
    [
      context.tenant.tenantId,
      accountId,
      input.transactionType,
      input.direction,
      input.amount,
      input.currency,
      input.relatedEntityType,
      input.relatedEntityId,
      input.occurredAt,
      context.actor.userId,
      input.description,
      input.correctionGroupId || null,
      input.reversedTransactionId || null,
    ],
  );
  return result.rows[0].financial_transaction_id;
}

async function requireVendorForTenant(client, tenantId, vendorId) {
  const result = await client.query("SELECT vendor_id, name FROM vendors WHERE tenant_id = $1 AND vendor_id = $2 AND status = 'active'", [tenantId, vendorId]);
  if (!result.rows[0]) {
    notFound("Proveedor no encontrado para esta empresa.");
  }
  return result.rows[0];
}

async function upsertVendorByName(client, context, vendorName) {
  const result = await client.query(
    `
      INSERT INTO vendors (tenant_id, name, status)
      VALUES ($1, $2, 'active')
      ON CONFLICT (tenant_id, name) DO UPDATE
      SET status = 'active', updated_at = now()
      RETURNING vendor_id, name
    `,
    [context.tenant.tenantId, vendorName],
  );
  return result.rows[0];
}

async function requireJobForTenant(client, tenantId, jobId) {
  const result = await client.query("SELECT job_id FROM jobs WHERE tenant_id = $1 AND job_id = $2", [tenantId, jobId]);
  if (!result.rows[0]) {
    notFound("Obra no encontrada para esta empresa.");
  }
}

async function requireExpenseForTenant(client, tenantId, expenseId) {
  const result = await client.query("SELECT * FROM expenses WHERE tenant_id = $1 AND expense_id = $2", [tenantId, expenseId]);
  if (!result.rows[0]) {
    notFound("Gasto no encontrado para esta empresa.");
  }
  return result.rows[0];
}

async function requireAccountForTenant(client, tenantId, accountId) {
  const result = await client.query(
    "SELECT financial_account_id FROM financial_accounts WHERE tenant_id = $1 AND financial_account_id = $2 AND status = 'active'",
    [tenantId, accountId],
  );
  if (!result.rows[0]) {
    notFound("Cuenta financiera no encontrada para esta empresa.");
  }
}

async function requireTransactionForTenant(client, tenantId, transactionId) {
  const result = await client.query(
    `
      SELECT ft.financial_transaction_id, ft.financial_account_id, fa.name AS account_name,
             ft.transaction_type, ft.direction, ft.amount, ft.currency, ft.description,
             ft.related_entity_type, ft.related_entity_id, ft.status, ft.occurred_at, ft.created_at,
             ft.corrected_by_transaction_id, ft.reversed_transaction_id, ft.correction_group_id
      FROM financial_transactions ft
      JOIN financial_accounts fa ON fa.tenant_id = ft.tenant_id AND fa.financial_account_id = ft.financial_account_id
      WHERE ft.tenant_id = $1 AND ft.financial_transaction_id = $2
    `,
    [tenantId, transactionId],
  );
  if (!result.rows[0]) {
    notFound("Movimiento financiero no encontrado para esta empresa.");
  }
  return result.rows[0];
}

async function getExpenseById(client, tenantId, expenseId) {
  const result = await client.query(
    `
      SELECT e.expense_id, e.expense_number, e.job_id, j.job_number, j.title AS job_title,
             e.vendor_id, COALESCE(v.name, e.vendor_name) AS vendor_name,
             e.category, e.description, e.status, e.total_amount, e.balance_amount,
             e.tax_amount, e.currency, e.issue_date, e.due_date, e.approved_by_user_id,
             e.approved_at, e.created_at, e.updated_at
      FROM expenses e
      LEFT JOIN vendors v ON v.tenant_id = e.tenant_id AND v.vendor_id = e.vendor_id
      LEFT JOIN jobs j ON j.tenant_id = e.tenant_id AND j.job_id = e.job_id
      WHERE e.tenant_id = $1 AND e.expense_id = $2
    `,
    [tenantId, expenseId],
  );
  return mapExpense(result.rows[0]);
}

async function generateExpenseNumber(client, tenantId) {
  const value = await nextDocumentSequence(client, { tenantId, documentType: "expense", series: "EXP" });
  return `EXP-${String(value).padStart(5, "0")}`;
}

async function summarizeExpenses(client, tenantId) {
  const result = await client.query(
    `
      SELECT
        COALESCE(sum(total_amount), 0)::numeric AS total,
        COALESCE(sum(balance_amount), 0)::numeric AS open,
        COALESCE(sum(balance_amount) FILTER (WHERE due_date < CURRENT_DATE AND status <> 'paid'), 0)::numeric AS overdue,
        count(*) FILTER (WHERE status = 'draft')::integer AS drafts,
        count(*) FILTER (WHERE status = 'approved')::integer AS approved
      FROM expenses
      WHERE tenant_id = $1 AND status <> 'void'
    `,
    [tenantId],
  );
  return {
    total: Number(result.rows[0]?.total || 0),
    open: Number(result.rows[0]?.open || 0),
    overdue: Number(result.rows[0]?.overdue || 0),
    drafts: Number(result.rows[0]?.drafts || 0),
    approved: Number(result.rows[0]?.approved || 0),
  };
}

async function sumInvoices(client, tenantId) {
  const result = await client.query("SELECT COALESCE(sum(total_amount), 0)::numeric AS total FROM invoices WHERE tenant_id = $1 AND status <> 'void'", [tenantId]);
  return { total: Number(result.rows[0]?.total || 0) };
}

async function sumTable(client, tenantId, table, column) {
  const result = await client.query(`SELECT COALESCE(sum(${column}), 0)::numeric AS total FROM ${table} WHERE tenant_id = $1`, [tenantId]);
  return Number(result.rows[0]?.total || 0);
}

async function periodSummary(client, tenantId, datePart) {
  const result = await client.query(
    `
      SELECT
        COALESCE(sum(amount) FILTER (WHERE transaction_type IN ('income', 'invoice_payment', 'cash_in')), 0)::numeric AS income,
        COALESCE(sum(amount) FILTER (WHERE transaction_type IN ('expense_accrual', 'cash_out')), 0)::numeric AS expenses
      FROM financial_transactions
      WHERE tenant_id = $1 AND status = 'posted' AND occurred_at >= date_trunc($2, now())
    `,
    [tenantId, datePart],
  );
  const income = Number(result.rows[0]?.income || 0);
  const expenses = Number(result.rows[0]?.expenses || 0);
  return { income, expenses, netProfit: income - expenses };
}

async function monthlyPeriodHistory(client, tenantId) {
  const result = await client.query(
    `
      SELECT
        date_trunc('month', occurred_at)::date AS month_start,
        COALESCE(sum(amount) FILTER (WHERE transaction_type IN ('income', 'invoice_payment', 'cash_in')), 0)::numeric AS income,
        COALESCE(sum(amount) FILTER (WHERE transaction_type IN ('expense_accrual', 'cash_out')), 0)::numeric AS expenses
      FROM financial_transactions
      WHERE tenant_id = $1
        AND status = 'posted'
        AND occurred_at >= date_trunc('month', now()) - interval '11 months'
      GROUP BY date_trunc('month', occurred_at)::date
      ORDER BY month_start DESC
      LIMIT 12
    `,
    [tenantId],
  );
  return result.rows.map((row) => {
    const income = Number(row.income || 0);
    const expenses = Number(row.expenses || 0);
    return {
      month: row.month_start?.toISOString?.().slice(0, 7) || String(row.month_start).slice(0, 7),
      income,
      expenses,
      netProfit: income - expenses,
    };
  });
}

async function latestTransactions(client, tenantId) {
  const result = await client.query(
    `
          SELECT ft.financial_transaction_id, ft.financial_account_id, fa.name AS account_name,
                 ft.transaction_type, ft.direction, ft.amount, ft.currency, ft.description,
                 ft.related_entity_type, ft.related_entity_id, ft.status, ft.occurred_at, ft.created_at,
                 ft.corrected_by_transaction_id, ft.reversed_transaction_id, ft.correction_group_id
      FROM financial_transactions ft
      JOIN financial_accounts fa ON fa.tenant_id = ft.tenant_id AND fa.financial_account_id = ft.financial_account_id
      WHERE ft.tenant_id = $1
      ORDER BY ft.occurred_at DESC, ft.created_at DESC
      LIMIT 10
    `,
    [tenantId],
  );
  return result.rows.map(mapTransaction);
}

async function accountBalanceByType(client, tenantId, accountType) {
  const result = await client.query(
    `
      SELECT COALESCE(sum(
        CASE
          WHEN $2 IN ('asset', 'expense') THEN CASE WHEN ft.direction = 'debit' THEN ft.amount ELSE -ft.amount END
          ELSE CASE WHEN ft.direction = 'credit' THEN ft.amount ELSE -ft.amount END
        END
      ), 0)::numeric AS balance
      FROM financial_transactions ft
      JOIN financial_accounts fa ON fa.tenant_id = ft.tenant_id AND fa.financial_account_id = ft.financial_account_id
      WHERE ft.tenant_id = $1 AND fa.account_type = $2 AND ft.status = 'posted'
    `,
    [tenantId, accountType],
  );
  return Number(result.rows[0]?.balance || 0);
}

async function calculateJobProfitability(client, tenantId) {
  const result = await client.query(
    `
      SELECT j.job_id, j.job_number, j.title,
             COALESCE(sum(DISTINCT i.total_amount), 0)::numeric AS income,
             COALESCE(sum(DISTINCT e.total_amount), 0)::numeric AS expenses
      FROM jobs j
      LEFT JOIN invoices i ON i.tenant_id = j.tenant_id AND i.job_id = j.job_id AND i.status <> 'void'
      LEFT JOIN expenses e ON e.tenant_id = j.tenant_id AND e.job_id = j.job_id AND e.status <> 'void'
      WHERE j.tenant_id = $1
      GROUP BY j.job_id
      ORDER BY j.updated_at DESC
      LIMIT 20
    `,
    [tenantId],
  );
  return result.rows.map((row) => {
    const income = Number(row.income || 0);
    const expenses = Number(row.expenses || 0);
    return {
      jobId: row.job_id,
      jobNumber: row.job_number,
      title: row.title,
      income,
      expenses,
      margin: income - expenses,
    };
  });
}

async function writeAudit(client, context, action, entityType, entityId, metadata) {
  await client.query(
    `
      INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, $2, $3, 'finance', $4, $5, 'info', $6::jsonb)
    `,
    [context.tenant.tenantId, context.actor.userId, action, entityType, entityId, JSON.stringify(metadata || {})],
  );
}

function validateVendorInput(input) {
  return {
    name: requiredText(input.name, 180, "Nombre de proveedor requerido."),
    category: nullableText(input.category, 120),
    contactName: nullableText(input.contactName, 160),
    phone: nullableText(input.phone, 60),
    email: nullableEmail(input.email),
    status: input.status && VENDOR_STATUSES.has(input.status) ? input.status : "active",
  };
}

function validateExpenseInput(input) {
  const totalAmount = positiveNumber(input.totalAmount, "Importe requerido.");
  const taxAmount = nonNegativeNumber(input.taxAmount, 0);
  return {
    vendorId: nullableText(input.vendorId, 80),
    vendorName: requiredText(input.vendorName || "Proveedor sin nombre", 180, "Proveedor requerido."),
    jobId: nullableText(input.jobId, 80),
    expenseNumber: nullableText(input.expenseNumber, 40),
    category: requiredText(input.category || "General", 120, "Categoria requerida."),
    description: nullableText(input.description, 1000) || "",
    currency: validateEnum(input.currency || "USD", CURRENCIES, "Moneda no soportada."),
    totalAmount,
    taxAmount,
    issueDate: nullableDate(input.issueDate) || new Date().toISOString().slice(0, 10),
    dueDate: nullableDate(input.dueDate),
  };
}

function validateExpensePaymentInput(input) {
  return {
    amount: positiveNumber(input.amount, "Importe de pago requerido."),
    method: requiredText(input.method || "cash", 60, "Metodo de pago requerido."),
    paidAt: nullableIso(input.paidAt) || new Date().toISOString(),
  };
}

function validateManualTransactionInput(input) {
  return {
    accountId: nullableText(input.accountId, 80),
    accountType: input.accountType && ACCOUNT_TYPES.has(input.accountType) ? input.accountType : "cash",
    transactionType: requiredText(input.transactionType || "manual", 80, "Tipo de movimiento requerido."),
    direction: validateEnum(input.direction || "debit", new Set(["debit", "credit"]), "Direccion no soportada."),
    amount: positiveNumber(input.amount, "Importe requerido."),
    currency: validateEnum(input.currency || "USD", CURRENCIES, "Moneda no soportada."),
    occurredAt: nullableIso(input.occurredAt) || new Date().toISOString(),
    description: nullableText(input.description, 500) || "Movimiento manual",
  };
}

function mapVendor(row) {
  return {
    vendorId: row.vendor_id,
    name: row.name,
    category: row.category || "",
    contactName: row.contact_name || "",
    phone: row.phone || "",
    email: row.email || "",
    status: row.status,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function mapExpense(row = {}) {
  return {
    expenseId: row.expense_id,
    expenseNumber: row.expense_number || "",
    jobId: row.job_id || null,
    jobNumber: row.job_number || "",
    jobTitle: row.job_title || "",
    vendorId: row.vendor_id || null,
    vendorName: row.vendor_name || row.raw_vendor_name || "",
    category: row.category || "",
    description: row.description || "",
    status: row.status,
    totalAmount: Number(row.total_amount || 0),
    balanceAmount: Number(row.balance_amount || 0),
    taxAmount: Number(row.tax_amount || 0),
    currency: row.currency || "USD",
    issueDate: row.issue_date?.toISOString?.().slice(0, 10) || row.issue_date || "",
    dueDate: row.due_date?.toISOString?.().slice(0, 10) || row.due_date || "",
    approvedAt: row.approved_at?.toISOString?.() || row.approved_at || "",
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function mapAccount(row) {
  return {
    accountId: row.financial_account_id,
    name: row.name,
    accountType: ACCOUNT_TYPES.has(row.account_type) ? row.account_type : "asset",
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function mapTransaction(row) {
  return {
    transactionId: row.financial_transaction_id,
    accountId: row.financial_account_id,
    accountName: row.account_name || "",
    transactionType: row.transaction_type,
    direction: row.direction || "",
    amount: Number(row.amount || 0),
    currency: row.currency,
    description: row.description || "",
    relatedEntityType: row.related_entity_type || "",
    relatedEntityId: row.related_entity_id || null,
    status: row.status || "posted",
    occurredAt: row.occurred_at?.toISOString?.() || row.occurred_at,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    correctedByTransactionId: row.corrected_by_transaction_id || null,
    reversedTransactionId: row.reversed_transaction_id || null,
    correctionGroupId: row.correction_group_id || null,
  };
}

function oppositeDirection(direction) {
  return direction === "debit" ? "credit" : "debit";
}

function validateEnum(value, allowed, message) {
  const text = String(value || "").trim();
  if (!allowed.has(text)) {
    validationError(message);
  }
  return text;
}

function requiredText(value, maxLength, message) {
  const text = String(value || "").trim();
  if (!text || text.length > maxLength) {
    validationError(message);
  }
  return text;
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

function nullableEmail(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) {
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(text)) {
    validationError("Correo no valido.");
  }
  return text;
}

function nullableDate(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) {
    validationError("Fecha no valida.");
  }
  return text;
}

function nullableIso(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    validationError("Fecha/hora no valida.");
  }
  return date.toISOString();
}

function positiveNumber(value, message) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    validationError(message);
  }
  return Math.round(number * 100) / 100;
}

function nonNegativeNumber(value, fallback = 0) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number) || number < 0) {
    validationError("Importe no valido.");
  }
  return Math.round(number * 100) / 100;
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
