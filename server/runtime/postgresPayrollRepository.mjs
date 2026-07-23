import { createPostgresPoolFromEnv } from "./postgresAuthRepository.mjs";

const PAY_TYPES = new Set(["hourly", "daily"]);
const PAYMENT_FREQUENCIES = new Set(["daily", "weekly", "biweekly", "monthly"]);
const CURRENCIES = new Set(["USD", "COP", "EUR"]);

export function createPostgresPayrollRepositoryFromEnv(env = process.env) {
  const pool = createPostgresPoolFromEnv(env);
  if (!pool) {
    return null;
  }

  return {
    ...createPostgresPayrollRepository(pool),
    async close() {
      await pool.end();
    },
  };
}

export function createPostgresPayrollRepository(pool) {
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

  async function listWorkers(context, filters = {}) {
    return queryForTenant(context, async (client) => {
      const settings = await getTenantSettings(client, context.tenant.tenantId);
      await ensureDefaultAccounts(client, context.tenant.tenantId, settings.currency);
      const workers = await client.query(
        `
          SELECT w.worker_id, w.name, w.trade, w.status, w.user_id, u.email,
                 COALESCE(pws.pay_type, 'hourly') AS pay_type,
                 COALESCE(pws.hourly_rate, 0)::numeric AS hourly_rate,
                 COALESCE(pws.daily_rate, 0)::numeric AS daily_rate,
                 COALESCE(pws.payment_frequency, 'weekly') AS payment_frequency,
                 COALESCE(pws.currency, $2) AS currency
          FROM workers w
          LEFT JOIN users u ON u.tenant_id = w.tenant_id AND u.user_id = w.user_id
          LEFT JOIN payroll_worker_settings pws ON pws.tenant_id = w.tenant_id AND pws.worker_id = w.worker_id
          WHERE w.tenant_id = $1 AND w.status = 'active'
          ORDER BY w.name ASC
          LIMIT 150
        `,
        [context.tenant.tenantId, settings.currency],
      );

      const items = [];
      for (const worker of workers.rows) {
        const pending = await calculatePendingForWorker(client, context.tenant.tenantId, worker.worker_id, filters);
        items.push(mapPayrollWorker(worker, pending));
      }

      const payments = await listRecentPayments(client, context.tenant.tenantId);
      const totalPendingAmount = items.reduce((sum, item) => sum + item.pendingAmount, 0);
      const pendingSeconds = items.reduce((sum, item) => sum + item.pendingPayableSeconds, 0);
      return {
        items,
        payments,
        summary: {
          workers: items.length,
          pendingWorkers: items.filter((item) => item.pendingEntries > 0).length,
          pendingPayableSeconds: pendingSeconds,
          pendingHours: round2(pendingSeconds / 3600),
          pendingAmount: round2(totalPendingAmount),
          currency: settings.currency,
        },
      };
    });
  }

  async function updateWorkerSettings(context, workerId, input = {}) {
    const clean = validateWorkerSettings(input);
    return queryForTenant(context, async (client) => {
      await requireWorkerForTenant(client, context.tenant.tenantId, workerId);
      const result = await client.query(
        `
          INSERT INTO payroll_worker_settings (
            tenant_id, worker_id, pay_type, hourly_rate, daily_rate, payment_frequency, currency, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
          ON CONFLICT (tenant_id, worker_id) DO UPDATE
          SET pay_type = EXCLUDED.pay_type,
              hourly_rate = EXCLUDED.hourly_rate,
              daily_rate = EXCLUDED.daily_rate,
              payment_frequency = EXCLUDED.payment_frequency,
              currency = EXCLUDED.currency,
              status = 'active',
              updated_at = now()
          RETURNING *
        `,
        [context.tenant.tenantId, workerId, clean.payType, clean.hourlyRate, clean.dailyRate, clean.paymentFrequency, clean.currency],
      );
      await writeAudit(client, context, "payroll.worker_settings.updated", "worker", workerId, clean);
      return mapWorkerSettings(result.rows[0]);
    });
  }

  async function createPayment(context, workerId, input = {}) {
    const clean = validatePaymentInput(input);
    return queryForTenant(context, async (client) => {
      const worker = await requireWorkerForTenant(client, context.tenant.tenantId, workerId);
      const settings = await getOrCreateWorkerSettings(client, context.tenant.tenantId, workerId);
      await lockPendingTimeEntriesForPayment(client, context.tenant.tenantId, workerId, {
        periodStart: clean.periodStart,
        periodEnd: clean.periodEnd,
      });
      const pending = await calculatePendingForWorker(client, context.tenant.tenantId, workerId, {
        periodStart: clean.periodStart,
        periodEnd: clean.periodEnd,
      });
      if (pending.entries.length === 0) {
        validationError("No hay horas cerradas pendientes de pago para este periodo.");
      }
      const rateAmount = settings.pay_type === "daily" ? Number(settings.daily_rate || 0) : Number(settings.hourly_rate || 0);
      if (rateAmount <= 0) {
        validationError("Configura la tarifa del trabajador antes de pagar nomina.");
      }
      const amount = calculateAmount(settings.pay_type, rateAmount, pending);
      if (amount <= 0) {
        validationError("El pago calculado debe ser mayor que cero.");
      }

      const paymentResult = await client.query(
        `
          INSERT INTO payroll_payments (
            tenant_id, worker_id, period_start, period_end, gross_seconds, break_seconds, payable_seconds,
            paid_days, pay_type, rate_amount, amount, currency, status, paid_at, created_by_user_id, notes
          )
          VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, 'paid', $13::timestamptz, $14, $15)
          RETURNING payroll_payment_id
        `,
        [
          context.tenant.tenantId,
          workerId,
          clean.periodStart,
          clean.periodEnd,
          pending.grossSeconds,
          pending.breakSeconds,
          pending.payableSeconds,
          pending.paidDays,
          settings.pay_type,
          rateAmount,
          amount,
          settings.currency,
          clean.paidAt,
          context.actor.userId,
          clean.notes,
        ],
      );
      const paymentId = paymentResult.rows[0].payroll_payment_id;

      for (const entry of pending.entries) {
        await client.query(
          `
            INSERT INTO payroll_payment_time_entries (
              tenant_id, payroll_payment_id, time_entry_id, gross_seconds, break_seconds, payable_seconds
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [context.tenant.tenantId, paymentId, entry.timeEntryId, entry.grossSeconds, entry.breakSeconds, entry.payableSeconds],
        );
      }

      await client.query(
        `
          UPDATE time_entries
          SET payroll_status = 'paid',
              payroll_payment_id = $3
          WHERE tenant_id = $1
            AND time_entry_id = ANY($2::uuid[])
        `,
        [context.tenant.tenantId, pending.entries.map((entry) => entry.timeEntryId), paymentId],
      );

      const financeTransactionId = await postPayrollCashOut(client, context, {
        paymentId,
        amount,
        currency: settings.currency,
        occurredAt: clean.paidAt,
        workerName: worker.name,
      });
      await client.query(
        "UPDATE payroll_payments SET finance_transaction_id = $3 WHERE tenant_id = $1 AND payroll_payment_id = $2",
        [context.tenant.tenantId, paymentId, financeTransactionId],
      );
      await writeAudit(client, context, "payroll.payment.created", "payroll_payment", paymentId, {
        workerId,
        amount,
        entries: pending.entries.length,
      });
      const payment = await getPaymentById(client, context.tenant.tenantId, paymentId);
      return payment;
    });
  }

  return {
    listWorkers,
    updateWorkerSettings,
    createPayment,
  };
}

async function getTenantSettings(client, tenantId) {
  const result = await client.query("SELECT currency FROM tenants WHERE tenant_id = $1", [tenantId]);
  return { currency: result.rows[0]?.currency || "USD" };
}

async function requireWorkerForTenant(client, tenantId, workerId) {
  const result = await client.query(
    "SELECT worker_id, name, status FROM workers WHERE tenant_id = $1 AND worker_id = $2 AND status = 'active'",
    [tenantId, workerId],
  );
  if (!result.rows[0]) {
    notFound("Trabajador activo no encontrado para esta empresa.");
  }
  return result.rows[0];
}

async function getOrCreateWorkerSettings(client, tenantId, workerId) {
  const tenant = await getTenantSettings(client, tenantId);
  const result = await client.query(
    `
      INSERT INTO payroll_worker_settings (tenant_id, worker_id, currency)
      VALUES ($1, $2, $3)
      ON CONFLICT (tenant_id, worker_id) DO NOTHING
      RETURNING *
    `,
    [tenantId, workerId, tenant.currency],
  );
  if (result.rows[0]) {
    return result.rows[0];
  }
  const existing = await client.query("SELECT * FROM payroll_worker_settings WHERE tenant_id = $1 AND worker_id = $2", [tenantId, workerId]);
  return existing.rows[0];
}

async function calculatePendingForWorker(client, tenantId, workerId, filters = {}) {
  const params = [tenantId, workerId];
  const where = [
    "te.tenant_id = $1",
    "te.worker_id = $2",
    "te.clock_out IS NOT NULL",
    "te.status IN ('submitted', 'approved')",
    "te.payroll_status = 'unpaid'",
  ];
  if (filters.periodStart) {
    params.push(filters.periodStart);
    where.push(`te.clock_in::date >= $${params.length}::date`);
  }
  if (filters.periodEnd) {
    params.push(filters.periodEnd);
    where.push(`te.clock_in::date <= $${params.length}::date`);
  }

  const result = await client.query(
    `
      SELECT te.time_entry_id, te.clock_in, te.clock_out,
             GREATEST(0, EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)))::integer AS gross_seconds,
             COALESCE(sum(EXTRACT(EPOCH FROM (COALESCE(be.ended_at, te.clock_out) - be.started_at))) FILTER (WHERE be.status IN ('closed', 'open')), 0)::integer AS break_seconds
      FROM time_entries te
      LEFT JOIN break_entries be ON be.tenant_id = te.tenant_id AND be.time_entry_id = te.time_entry_id
      WHERE ${where.join(" AND ")}
      GROUP BY te.time_entry_id
      ORDER BY te.clock_in ASC
      LIMIT 500
    `,
    params,
  );
  const entries = result.rows.map((row) => {
    const grossSeconds = Number(row.gross_seconds || 0);
    const breakSeconds = Number(row.break_seconds || 0);
    return {
      timeEntryId: row.time_entry_id,
      clockIn: row.clock_in,
      clockOut: row.clock_out,
      grossSeconds,
      breakSeconds,
      payableSeconds: Math.max(0, grossSeconds - breakSeconds),
    };
  });
  const dayKeys = new Set(entries.map((entry) => new Date(entry.clockIn).toISOString().slice(0, 10)));
  return {
    entries,
    grossSeconds: entries.reduce((sum, entry) => sum + entry.grossSeconds, 0),
    breakSeconds: entries.reduce((sum, entry) => sum + entry.breakSeconds, 0),
    payableSeconds: entries.reduce((sum, entry) => sum + entry.payableSeconds, 0),
    paidDays: dayKeys.size,
  };
}

async function lockPendingTimeEntriesForPayment(client, tenantId, workerId, filters = {}) {
  const params = [tenantId, workerId];
  const where = [
    "tenant_id = $1",
    "worker_id = $2",
    "clock_out IS NOT NULL",
    "status IN ('submitted', 'approved')",
    "payroll_status = 'unpaid'",
  ];
  if (filters.periodStart) {
    params.push(filters.periodStart);
    where.push(`clock_in::date >= $${params.length}::date`);
  }
  if (filters.periodEnd) {
    params.push(filters.periodEnd);
    where.push(`clock_in::date <= $${params.length}::date`);
  }

  await client.query(
    `
      SELECT time_entry_id
      FROM time_entries
      WHERE ${where.join(" AND ")}
      ORDER BY clock_in ASC
      FOR UPDATE
    `,
    params,
  );
}

async function listRecentPayments(client, tenantId) {
  const result = await client.query(
    `
      SELECT pp.payroll_payment_id, pp.worker_id, w.name AS worker_name, pp.period_start, pp.period_end,
             pp.payable_seconds, pp.paid_days, pp.pay_type, pp.rate_amount, pp.amount, pp.currency,
             pp.status, pp.paid_at, pp.finance_transaction_id, pp.notes
      FROM payroll_payments pp
      JOIN workers w ON w.tenant_id = pp.tenant_id AND w.worker_id = pp.worker_id
      WHERE pp.tenant_id = $1
      ORDER BY pp.paid_at DESC, pp.created_at DESC
      LIMIT 80
    `,
    [tenantId],
  );
  return result.rows.map(mapPayment);
}

async function getPaymentById(client, tenantId, paymentId) {
  const result = await client.query(
    `
      SELECT pp.payroll_payment_id, pp.worker_id, w.name AS worker_name, pp.period_start, pp.period_end,
             pp.payable_seconds, pp.paid_days, pp.pay_type, pp.rate_amount, pp.amount, pp.currency,
             pp.status, pp.paid_at, pp.finance_transaction_id, pp.notes
      FROM payroll_payments pp
      JOIN workers w ON w.tenant_id = pp.tenant_id AND w.worker_id = pp.worker_id
      WHERE pp.tenant_id = $1 AND pp.payroll_payment_id = $2
    `,
    [tenantId, paymentId],
  );
  return result.rows[0] ? mapPayment(result.rows[0]) : null;
}

async function ensureDefaultAccounts(client, tenantId, currency) {
  const defaults = [
    ["Caja", "cash"],
    ["Gastos", "expense"],
  ];
  for (const [name, accountType] of defaults) {
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

async function postPayrollCashOut(client, context, input) {
  const cashAccountId = await accountIdByType(client, context.tenant.tenantId, "cash", input.currency);
  const result = await client.query(
    `
      INSERT INTO financial_transactions (
        tenant_id, financial_account_id, transaction_type, direction, amount, currency,
        related_entity_type, related_entity_id, occurred_at, created_by_user_id, description, status
      )
      VALUES ($1, $2, 'cash_out', 'credit', $3, $4, 'payroll_payment', $5, $6::timestamptz, $7, $8, 'posted')
      RETURNING financial_transaction_id
    `,
    [
      context.tenant.tenantId,
      cashAccountId,
      input.amount,
      input.currency,
      input.paymentId,
      input.occurredAt,
      context.actor.userId,
      `Pago de nomina - ${input.workerName}`,
    ],
  );
  return result.rows[0].financial_transaction_id;
}

async function writeAudit(client, context, action, entityType, entityId, metadata) {
  await client.query(
    `
      INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, $2, $3, 'payroll', $4, $5, 'info', $6::jsonb)
    `,
    [context.tenant.tenantId, context.actor.userId, action, entityType, entityId, JSON.stringify(metadata || {})],
  );
}

function calculateAmount(payType, rateAmount, pending) {
  if (payType === "daily") {
    return round2(rateAmount * pending.paidDays);
  }
  return round2((pending.payableSeconds / 3600) * rateAmount);
}

function validateWorkerSettings(input = {}) {
  const payType = String(input.payType || "hourly").trim();
  const paymentFrequency = String(input.paymentFrequency || "weekly").trim();
  const currency = String(input.currency || "USD").trim().toUpperCase();
  if (!PAY_TYPES.has(payType)) {
    validationError("Tipo de pago no valido.");
  }
  if (!PAYMENT_FREQUENCIES.has(paymentFrequency)) {
    validationError("Frecuencia de pago no valida.");
  }
  if (!CURRENCIES.has(currency)) {
    validationError("Moneda no valida.");
  }
  return {
    payType,
    hourlyRate: money(input.hourlyRate),
    dailyRate: money(input.dailyRate),
    paymentFrequency,
    currency,
  };
}

function validatePaymentInput(input = {}) {
  const now = new Date();
  const periodEnd = input.periodEnd ? String(input.periodEnd).slice(0, 10) : now.toISOString().slice(0, 10);
  const periodStart = input.periodStart ? String(input.periodStart).slice(0, 10) : new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  if (Number.isNaN(Date.parse(periodStart)) || Number.isNaN(Date.parse(periodEnd)) || periodStart > periodEnd) {
    validationError("Periodo de nomina no valido.");
  }
  return {
    periodStart,
    periodEnd,
    paidAt: input.paidAt && !Number.isNaN(Date.parse(input.paidAt)) ? input.paidAt : new Date().toISOString(),
    notes: nullableText(input.notes, 500),
  };
}

function money(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0 || number > 999999999) {
    validationError("Valor de tarifa no valido.");
  }
  return round2(number);
}

function mapPayrollWorker(row, pending) {
  const settings = mapWorkerSettings(row);
  return {
    workerId: row.worker_id,
    userId: row.user_id || null,
    name: row.name,
    email: row.email || "",
    trade: row.trade || "",
    status: row.status,
    ...settings,
    pendingEntries: pending.entries.length,
    pendingGrossSeconds: pending.grossSeconds,
    pendingBreakSeconds: pending.breakSeconds,
    pendingPayableSeconds: pending.payableSeconds,
    pendingHours: round2(pending.payableSeconds / 3600),
    pendingDays: pending.paidDays,
    pendingAmount: calculateAmount(settings.payType, settings.payType === "daily" ? settings.dailyRate : settings.hourlyRate, pending),
  };
}

function mapWorkerSettings(row) {
  return {
    payType: row.pay_type,
    hourlyRate: Number(row.hourly_rate || 0),
    dailyRate: Number(row.daily_rate || 0),
    paymentFrequency: row.payment_frequency,
    currency: row.currency || "USD",
  };
}

function mapPayment(row) {
  return {
    payrollPaymentId: row.payroll_payment_id,
    workerId: row.worker_id,
    workerName: row.worker_name || "",
    periodStart: row.period_start?.toISOString?.().slice(0, 10) || row.period_start,
    periodEnd: row.period_end?.toISOString?.().slice(0, 10) || row.period_end,
    payableSeconds: Number(row.payable_seconds || 0),
    payableHours: round2(Number(row.payable_seconds || 0) / 3600),
    paidDays: Number(row.paid_days || 0),
    payType: row.pay_type,
    rateAmount: Number(row.rate_amount || 0),
    amount: Number(row.amount || 0),
    currency: row.currency || "USD",
    status: row.status,
    paidAt: row.paid_at?.toISOString?.() || row.paid_at,
    financeTransactionId: row.finance_transaction_id || null,
    notes: row.notes || "",
  };
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
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
