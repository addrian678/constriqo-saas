import { createPostgresPoolFromEnv } from "./postgresAuthRepository.mjs";
import { nextDocumentSequence } from "./documentSequences.mjs";

const ASSET_STATUSES = new Set(["active", "maintenance", "retired"]);
const LIABILITY_STATUSES = new Set(["active", "paid", "defaulted", "cancelled"]);

export function createPostgresAssetsRepositoryFromEnv(env = process.env) {
  const pool = createPostgresPoolFromEnv(env);
  if (!pool) {
    return null;
  }

  return {
    ...createPostgresAssetsRepository(pool),
    async close() {
      await pool.end();
    },
  };
}

export function createPostgresAssetsRepository(pool) {
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

  async function listAssets(context) {
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          SELECT asset_id, code, name, category, status, book_value, warranty_expires_at, created_at
          FROM assets
          WHERE tenant_id = $1
          ORDER BY created_at DESC, name ASC
          LIMIT 150
        `,
        [context.tenant.tenantId],
      );
      const summary = await summarizeAssets(client, context.tenant.tenantId);
      return { items: result.rows.map(mapAsset), total: result.rowCount, summary };
    });
  }

  async function createAsset(context, input = {}) {
    const clean = validateAssetInput(input);
    return queryForTenant(context, async (client) => {
      const code = clean.code || (await generateAssetCode(client, context.tenant.tenantId, clean.category));
      const result = await client.query(
        `
          INSERT INTO assets (tenant_id, code, name, category, status, book_value, warranty_expires_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7::date)
          RETURNING asset_id, code, name, category, status, book_value, warranty_expires_at, created_at
        `,
        [context.tenant.tenantId, code, clean.name, clean.category, clean.status, clean.bookValue, clean.warrantyExpiresAt],
      );
      await writeAudit(client, context, "assets.created", "asset", result.rows[0].asset_id, {
        code,
        category: clean.category,
        bookValue: clean.bookValue,
      });
      return mapAsset(result.rows[0]);
    });
  }

  async function listLiabilities(context) {
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          SELECT liability_id, reference, lender, status, principal_amount, balance_amount, next_due_date, created_at
          FROM liabilities
          WHERE tenant_id = $1
          ORDER BY next_due_date NULLS LAST, created_at DESC
          LIMIT 150
        `,
        [context.tenant.tenantId],
      );
      const summary = await summarizeLiabilities(client, context.tenant.tenantId);
      return { items: result.rows.map(mapLiability), total: result.rowCount, summary };
    });
  }

  async function createLiability(context, input = {}) {
    const clean = validateLiabilityInput(input);
    return queryForTenant(context, async (client) => {
      const reference = clean.reference || (await generateLiabilityReference(client, context.tenant.tenantId));
      const result = await client.query(
        `
          INSERT INTO liabilities (tenant_id, reference, lender, status, principal_amount, balance_amount, next_due_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7::date)
          RETURNING liability_id, reference, lender, status, principal_amount, balance_amount, next_due_date, created_at
        `,
        [
          context.tenant.tenantId,
          reference,
          clean.lender,
          clean.status,
          clean.principalAmount,
          clean.balanceAmount,
          clean.nextDueDate,
        ],
      );
      await writeAudit(client, context, "liabilities.created", "liability", result.rows[0].liability_id, {
        reference,
        lender: clean.lender,
        balanceAmount: clean.balanceAmount,
      });
      return mapLiability(result.rows[0]);
    });
  }

  return {
    listAssets,
    createAsset,
    listLiabilities,
    createLiability,
  };
}

async function summarizeAssets(client, tenantId) {
  const result = await client.query(
    `
      SELECT
        COALESCE(sum(book_value), 0)::numeric AS book_value,
        count(*) FILTER (WHERE status = 'active')::integer AS active,
        count(*) FILTER (WHERE status = 'maintenance')::integer AS maintenance,
        count(*) FILTER (WHERE status = 'retired')::integer AS retired
      FROM assets
      WHERE tenant_id = $1
    `,
    [tenantId],
  );
  return {
    bookValue: Number(result.rows[0]?.book_value || 0),
    active: Number(result.rows[0]?.active || 0),
    maintenance: Number(result.rows[0]?.maintenance || 0),
    retired: Number(result.rows[0]?.retired || 0),
  };
}

async function summarizeLiabilities(client, tenantId) {
  const result = await client.query(
    `
      SELECT
        COALESCE(sum(principal_amount), 0)::numeric AS principal_amount,
        COALESCE(sum(balance_amount), 0)::numeric AS balance_amount,
        COALESCE(sum(balance_amount) FILTER (WHERE next_due_date < CURRENT_DATE AND status = 'active'), 0)::numeric AS overdue,
        count(*) FILTER (WHERE status = 'active')::integer AS active,
        count(*) FILTER (WHERE status = 'paid')::integer AS paid
      FROM liabilities
      WHERE tenant_id = $1
    `,
    [tenantId],
  );
  return {
    principalAmount: Number(result.rows[0]?.principal_amount || 0),
    balanceAmount: Number(result.rows[0]?.balance_amount || 0),
    overdue: Number(result.rows[0]?.overdue || 0),
    active: Number(result.rows[0]?.active || 0),
    paid: Number(result.rows[0]?.paid || 0),
  };
}

async function generateAssetCode(client, tenantId, category) {
  const prefix = `AST-${slugCode(category).slice(0, 3) || "GEN"}`;
  const value = await nextDocumentSequence(client, { tenantId, documentType: "asset", series: prefix });
  return `${prefix}-${String(value).padStart(4, "0")}`;
}

async function generateLiabilityReference(client, tenantId) {
  const value = await nextDocumentSequence(client, { tenantId, documentType: "liability", series: "PAS" });
  return `PAS-${String(value).padStart(5, "0")}`;
}

async function writeAudit(client, context, action, entityType, entityId, metadata) {
  await client.query(
    `
      INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, $2, $3, 'assets-liabilities', $4, $5, 'info', $6::jsonb)
    `,
    [context.tenant.tenantId, context.actor.userId, action, entityType, entityId, JSON.stringify(metadata || {})],
  );
}

function validateAssetInput(input) {
  return {
    code: nullableText(input.code, 40),
    name: requiredText(input.name, 180, "Nombre del activo requerido."),
    category: requiredText(input.category || "Equipo", 120, "Categoria requerida."),
    status: validateEnum(input.status || "active", ASSET_STATUSES, "Estado de activo no soportado."),
    bookValue: nonNegativeNumber(input.bookValue ?? input.book_value, 0),
    warrantyExpiresAt: nullableDate(input.warrantyExpiresAt || input.warranty_expires_at),
  };
}

function validateLiabilityInput(input) {
  const principalAmount = positiveNumber(input.principalAmount ?? input.principal_amount, "Importe principal requerido.");
  return {
    reference: nullableText(input.reference, 40),
    lender: requiredText(input.lender, 180, "Entidad o acreedor requerido."),
    status: validateEnum(input.status || "active", LIABILITY_STATUSES, "Estado de pasivo no soportado."),
    principalAmount,
    balanceAmount: nonNegativeNumber(input.balanceAmount ?? input.balance_amount ?? principalAmount, principalAmount),
    nextDueDate: nullableDate(input.nextDueDate || input.next_due_date),
  };
}

function mapAsset(row) {
  return {
    assetId: row.asset_id,
    code: row.code,
    name: row.name,
    category: row.category,
    status: row.status,
    bookValue: Number(row.book_value || 0),
    warrantyExpiresAt: row.warranty_expires_at?.toISOString?.().slice(0, 10) || row.warranty_expires_at || "",
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  };
}

function mapLiability(row) {
  return {
    liabilityId: row.liability_id,
    reference: row.reference,
    lender: row.lender,
    status: row.status,
    principalAmount: Number(row.principal_amount || 0),
    balanceAmount: Number(row.balance_amount || 0),
    nextDueDate: row.next_due_date?.toISOString?.().slice(0, 10) || row.next_due_date || "",
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  };
}

function slugCode(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/giu, "")
    .toUpperCase();
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
