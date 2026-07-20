import { createPostgresPoolFromEnv } from "./postgresAuthRepository.mjs";

const COUNTRIES = new Set(["US", "CO", "ES"]);
const CURRENCIES = new Set(["USD", "COP", "EUR"]);
const UNIT_SYSTEMS = new Set(["imperial", "metric"]);
const IMPERIAL_UNITS = new Set(["sq_ft", "linear_ft", "ft", "in", "unit", "hour", "day"]);
const METRIC_UNITS = new Set(["m2", "linear_m", "m", "cm", "unit", "hour", "day"]);
const STATUSES = new Set(["active", "archived"]);

export function createPostgresServiceCatalogRepositoryFromEnv(env = process.env) {
  const pool = createPostgresPoolFromEnv(env);
  if (!pool) {
    return null;
  }

  return {
    ...createPostgresServiceCatalogRepository(pool),
    async close() {
      await pool.end();
    },
  };
}

export function createPostgresServiceCatalogRepository(pool) {
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

  async function listServices(context, filters = {}) {
    return queryForTenant(context, async (client) => {
      const params = [context.tenant.tenantId];
      const where = ["tenant_id = $1"];
      if (filters.status && STATUSES.has(filters.status)) {
        params.push(filters.status);
        where.push(`status = $${params.length}`);
      } else {
        where.push("status = 'active'");
      }
      if (filters.search) {
        params.push(`%${String(filters.search).trim().toLowerCase()}%`);
        where.push(`(lower(name) LIKE $${params.length} OR lower(code) LIKE $${params.length} OR lower(category) LIKE $${params.length})`);
      }
      const result = await client.query(
        `
          SELECT service_catalog_item_id, code, name, category, description, country_profile,
                 unit_system, unit_code, currency, unit_price, unit_cost, default_tax_rate,
                 margin_percent, minimum_quantity, status, inclusions, exclusions, conditions,
                 created_at, updated_at
          FROM service_catalog_items
          WHERE ${where.join(" AND ")}
          ORDER BY category, name
          LIMIT 200
        `,
        params,
      );
      return { items: result.rows.map(mapService), total: result.rowCount };
    });
  }

  async function createService(context, input) {
    const clean = validateServiceInput(input);
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          INSERT INTO service_catalog_items (
            tenant_id, code, name, category, description, country_profile, unit_system, unit_code,
            currency, unit_price, unit_cost, default_tax_rate, margin_percent, minimum_quantity,
            inclusions, exclusions, conditions, created_by_user_id, updated_by_user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18)
          RETURNING service_catalog_item_id, code, name, category, description, country_profile,
                    unit_system, unit_code, currency, unit_price, unit_cost, default_tax_rate,
                    margin_percent, minimum_quantity, status, inclusions, exclusions, conditions,
                    created_at, updated_at
        `,
        [
          context.tenant.tenantId,
          clean.code,
          clean.name,
          clean.category,
          clean.description,
          clean.countryProfile,
          clean.unitSystem,
          clean.unitCode,
          clean.currency,
          clean.unitPrice,
          clean.unitCost,
          clean.defaultTaxRate,
          clean.marginPercent,
          clean.minimumQuantity,
          clean.inclusions,
          clean.exclusions,
          clean.conditions,
          context.actor.userId,
        ],
      );
      await writeAudit(client, context, "services.created", "service_catalog_item", result.rows[0].service_catalog_item_id, {
        code: clean.code,
        unitCode: clean.unitCode,
        currency: clean.currency,
      });
      return mapService(result.rows[0]);
    });
  }

  async function updateService(context, serviceId, input) {
    const clean = validateServiceInput(input, { partial: true });
    return queryForTenant(context, async (client) => {
      const current = await client.query(
        "SELECT service_catalog_item_id FROM service_catalog_items WHERE tenant_id = $1 AND service_catalog_item_id = $2",
        [context.tenant.tenantId, serviceId],
      );
      if (!current.rows[0]) {
        return null;
      }
      const result = await client.query(
        `
          UPDATE service_catalog_items
          SET code = COALESCE($3, code),
              name = COALESCE($4, name),
              category = COALESCE($5, category),
              description = COALESCE($6, description),
              country_profile = COALESCE($7, country_profile),
              unit_system = COALESCE($8, unit_system),
              unit_code = COALESCE($9, unit_code),
              currency = COALESCE($10, currency),
              unit_price = COALESCE($11, unit_price),
              unit_cost = COALESCE($12, unit_cost),
              default_tax_rate = COALESCE($13, default_tax_rate),
              margin_percent = COALESCE($14, margin_percent),
              minimum_quantity = COALESCE($15, minimum_quantity),
              inclusions = COALESCE($16, inclusions),
              exclusions = COALESCE($17, exclusions),
              conditions = COALESCE($18, conditions),
              status = COALESCE($19, status),
              updated_by_user_id = $20,
              updated_at = now()
          WHERE tenant_id = $1 AND service_catalog_item_id = $2
          RETURNING service_catalog_item_id, code, name, category, description, country_profile,
                    unit_system, unit_code, currency, unit_price, unit_cost, default_tax_rate,
                    margin_percent, minimum_quantity, status, inclusions, exclusions, conditions,
                    created_at, updated_at
        `,
        [
          context.tenant.tenantId,
          serviceId,
          clean.code,
          clean.name,
          clean.category,
          clean.description,
          clean.countryProfile,
          clean.unitSystem,
          clean.unitCode,
          clean.currency,
          clean.unitPrice,
          clean.unitCost,
          clean.defaultTaxRate,
          clean.marginPercent,
          clean.minimumQuantity,
          clean.inclusions,
          clean.exclusions,
          clean.conditions,
          clean.status,
          context.actor.userId,
        ],
      );
      await writeAudit(client, context, "services.updated", "service_catalog_item", serviceId, { fields: Object.keys(clean).filter((key) => clean[key] !== undefined) });
      return mapService(result.rows[0]);
    });
  }

  async function archiveService(context, serviceId) {
    return updateService(context, serviceId, { status: "archived" });
  }

  async function getServiceForTenant(client, tenantId, serviceId) {
    if (!serviceId) {
      return null;
    }
    const result = await client.query(
      `
        SELECT service_catalog_item_id, code, name, category, description, country_profile,
               unit_system, unit_code, currency, unit_price, unit_cost, default_tax_rate,
               margin_percent, minimum_quantity, status, inclusions, exclusions, conditions,
               created_at, updated_at
        FROM service_catalog_items
        WHERE tenant_id = $1 AND service_catalog_item_id = $2 AND status = 'active'
      `,
      [tenantId, serviceId],
    );
    return result.rows[0] ? mapService(result.rows[0]) : null;
  }

  return {
    listServices,
    createService,
    updateService,
    archiveService,
    getServiceForTenant,
  };
}

function validateServiceInput(input, options = {}) {
  const partial = Boolean(options.partial);
  const unitSystem = optionalEnum(input?.unitSystem, UNIT_SYSTEMS, "Sistema de unidades no soportado.", partial) || undefined;
  const unitCode = optionalUnit(input?.unitCode, unitSystem, partial);
  return {
    code: optionalText(input?.code, 40, partial ? "" : "Codigo requerido.", partial)?.toUpperCase(),
    name: optionalText(input?.name, 160, partial ? "" : "Nombre requerido.", partial),
    category: optionalText(input?.category || "general", 80, "Categoria requerida.", partial),
    description: optionalText(input?.description || "", 500, "", true) ?? undefined,
    countryProfile: optionalEnum(input?.countryProfile, COUNTRIES, "Pais/mercado no soportado.", partial),
    unitSystem,
    unitCode,
    currency: optionalEnum(input?.currency, CURRENCIES, "Moneda no soportada.", partial),
    unitPrice: optionalNumber(input?.unitPrice, 0, 1_000_000_000, partial),
    unitCost: optionalNumber(input?.unitCost, 0, 1_000_000_000, true),
    defaultTaxRate: optionalNumber(input?.defaultTaxRate, 0, 100, true),
    marginPercent: optionalNumber(input?.marginPercent, -100, 1000, true),
    minimumQuantity: optionalNumber(input?.minimumQuantity, 0.01, 1_000_000, true),
    inclusions: optionalText(input?.inclusions || "", 1000, "", true) ?? undefined,
    exclusions: optionalText(input?.exclusions || "", 1000, "", true) ?? undefined,
    conditions: optionalText(input?.conditions || "", 1000, "", true) ?? undefined,
    status: optionalEnum(input?.status, STATUSES, "Estado de servicio no valido.", true),
  };
}

function optionalUnit(value, unitSystem, optional) {
  if ((value === undefined || value === null || value === "") && optional) {
    return undefined;
  }
  const text = String(value || "").trim();
  const allowed = unitSystem === "metric" ? METRIC_UNITS : IMPERIAL_UNITS;
  if (!allowed.has(text)) {
    validationError("Unidad no compatible con el sistema de unidades.");
  }
  return text;
}

function optionalEnum(value, allowed, message, optional) {
  if ((value === undefined || value === null || value === "") && optional) {
    return undefined;
  }
  const text = String(value || "").trim();
  if (!allowed.has(text)) {
    validationError(message);
  }
  return text;
}

function optionalText(value, maxLength, message, optional) {
  if ((value === undefined || value === null) && optional) {
    return undefined;
  }
  const text = String(value || "").trim();
  if (!text && optional) {
    return "";
  }
  if (!text || text.length > maxLength) {
    validationError(message || `El campo excede ${maxLength} caracteres.`);
  }
  return text;
}

function optionalNumber(value, min, max, optional) {
  if ((value === undefined || value === null || value === "") && optional) {
    return undefined;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    validationError(`Numero fuera de rango (${min}-${max}).`);
  }
  return number;
}

async function writeAudit(client, context, action, entityType, entityId, metadata) {
  await client.query(
    `
      INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, $2, $3, 'services-prices', $4, $5, 'info', $6::jsonb)
    `,
    [context.tenant.tenantId, context.actor.userId, action, entityType, entityId, JSON.stringify(metadata || {})],
  );
}

function mapService(row) {
  return {
    serviceId: row.service_catalog_item_id,
    code: row.code,
    name: row.name,
    category: row.category,
    description: row.description || "",
    countryProfile: row.country_profile,
    unitSystem: row.unit_system,
    unitCode: row.unit_code,
    currency: row.currency,
    unitPrice: Number(row.unit_price || 0),
    unitCost: Number(row.unit_cost || 0),
    defaultTaxRate: Number(row.default_tax_rate || 0),
    marginPercent: Number(row.margin_percent || 0),
    minimumQuantity: Number(row.minimum_quantity || 1),
    status: row.status,
    inclusions: row.inclusions || "",
    exclusions: row.exclusions || "",
    conditions: row.conditions || "",
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = "VALIDATION_ERROR";
  throw error;
}
