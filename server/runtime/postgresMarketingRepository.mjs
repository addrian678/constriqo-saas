import { createPostgresPoolFromEnv } from "./postgresAuthRepository.mjs";
import { nextDocumentSequence } from "./documentSequences.mjs";

const CAMPAIGN_STATUSES = new Set(["draft", "active", "paused", "closed"]);
const LEAD_STATUSES = new Set(["new", "contacted", "qualified", "converted", "discarded"]);
const CONSENT_STATUSES = new Set(["pending", "accepted", "rejected"]);
const LOYALTY_CARD_STATUSES = new Set(["active", "redeemed", "expired", "cancelled"]);
const LOYALTY_REWARD_TYPES = new Set(["discount_percent", "discount_amount", "gift", "custom"]);

export function createPostgresMarketingRepositoryFromEnv(env = process.env) {
  const pool = createPostgresPoolFromEnv(env);
  if (!pool) {
    return null;
  }

  return {
    ...createPostgresMarketingRepository(pool),
    async close() {
      await pool.end();
    },
  };
}

export function createPostgresMarketingRepository(pool) {
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

  async function listCampaigns(context) {
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          SELECT c.marketing_campaign_id, c.name, c.channel, c.status, c.budget_amount, c.created_at, c.updated_at,
                 count(l.marketing_lead_id)::integer AS leads_count,
                 count(l.marketing_lead_id) FILTER (WHERE l.status = 'converted')::integer AS conversions_count
          FROM marketing_campaigns c
          LEFT JOIN marketing_leads l ON l.tenant_id = c.tenant_id AND l.marketing_campaign_id = c.marketing_campaign_id
          WHERE c.tenant_id = $1
          GROUP BY c.marketing_campaign_id
          ORDER BY c.updated_at DESC, c.created_at DESC
          LIMIT 100
        `,
        [context.tenant.tenantId],
      );
      return { items: result.rows.map(mapCampaign), total: result.rowCount };
    });
  }

  async function createCampaign(context, input = {}) {
    const clean = validateCampaignInput(input);
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          INSERT INTO marketing_campaigns (tenant_id, name, channel, status, budget_amount, created_by_user_id)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING marketing_campaign_id, name, channel, status, budget_amount, created_at, updated_at,
                    0::integer AS leads_count, 0::integer AS conversions_count
        `,
        [context.tenant.tenantId, clean.name, clean.channel, clean.status, clean.budgetAmount, context.actor.userId],
      );
      await writeAudit(client, context, "marketing.campaign.created", "marketing_campaign", result.rows[0].marketing_campaign_id, {
        channel: clean.channel,
      });
      return mapCampaign(result.rows[0]);
    });
  }

  async function listLeads(context) {
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          SELECT l.marketing_lead_id, l.marketing_campaign_id, c.name AS campaign_name, l.name, l.source,
                 l.service_interest, l.status, l.consent_status, l.converted_client_id, l.email, l.phone,
                 l.notes, l.created_at, l.updated_at
          FROM marketing_leads l
          LEFT JOIN marketing_campaigns c ON c.tenant_id = l.tenant_id AND c.marketing_campaign_id = l.marketing_campaign_id
          WHERE l.tenant_id = $1
          ORDER BY l.updated_at DESC, l.created_at DESC
          LIMIT 150
        `,
        [context.tenant.tenantId],
      );
      const summary = await summarizeLeads(client, context.tenant.tenantId);
      return { items: result.rows.map(mapLead), total: result.rowCount, summary };
    });
  }

  async function createLead(context, input = {}) {
    const clean = validateLeadInput(input);
    return queryForTenant(context, async (client) => {
      if (clean.campaignId) {
        await requireCampaignForTenant(client, context.tenant.tenantId, clean.campaignId);
      }
      const result = await client.query(
        `
          INSERT INTO marketing_leads (
            tenant_id, marketing_campaign_id, name, source, service_interest, status,
            consent_status, email, phone, notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING marketing_lead_id, marketing_campaign_id, NULL::text AS campaign_name, name, source,
                    service_interest, status, consent_status, converted_client_id, email, phone, notes, created_at, updated_at
        `,
        [
          context.tenant.tenantId,
          clean.campaignId,
          clean.name,
          clean.source,
          clean.serviceInterest,
          clean.status,
          clean.consentStatus,
          clean.email,
          clean.phone,
          clean.notes,
        ],
      );
      await writeAudit(client, context, "marketing.lead.created", "marketing_lead", result.rows[0].marketing_lead_id, {
        source: clean.source,
        consentStatus: clean.consentStatus,
      });
      return mapLead(result.rows[0]);
    });
  }

  async function convertLead(context, leadId) {
    return queryForTenant(context, async (client) => {
      const lead = await requireLeadForTenant(client, context.tenant.tenantId, leadId);
      if (lead.converted_client_id) {
        return { lead: mapLead(lead), clientId: lead.converted_client_id };
      }
      if (lead.consent_status !== "accepted") {
        validationError("El lead requiere consentimiento aceptado antes de convertirse a CRM.");
      }
      const clientResult = await client.query(
        `
          INSERT INTO clients (tenant_id, name, status, primary_contact, phone, email)
          VALUES ($1, $2, 'lead', $3, $4, $5)
          RETURNING client_id
        `,
        [context.tenant.tenantId, lead.name, lead.name, lead.phone, lead.email],
      );
      const update = await client.query(
        `
          UPDATE marketing_leads
          SET status = 'converted', converted_client_id = $3, updated_at = now()
          WHERE tenant_id = $1 AND marketing_lead_id = $2
          RETURNING marketing_lead_id, marketing_campaign_id, NULL::text AS campaign_name, name, source,
                    service_interest, status, consent_status, converted_client_id, email, phone, notes, created_at, updated_at
        `,
        [context.tenant.tenantId, leadId, clientResult.rows[0].client_id],
      );
      await writeAudit(client, context, "marketing.lead.converted", "marketing_lead", leadId, {
        clientId: clientResult.rows[0].client_id,
      });
      return { lead: mapLead(update.rows[0]), clientId: clientResult.rows[0].client_id };
    });
  }

  async function listLoyaltyCards(context) {
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          SELECT marketing_loyalty_card_id, card_code, title, customer_name, customer_phone,
                 required_stamps, current_stamps, reward_type, reward_value, reward_description,
                 status, expires_on, created_at, updated_at
          FROM marketing_loyalty_cards
          WHERE tenant_id = $1
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 150
        `,
        [context.tenant.tenantId],
      );
      const summary = await summarizeLoyaltyCards(client, context.tenant.tenantId);
      return { items: result.rows.map(mapLoyaltyCard), total: result.rowCount, summary };
    });
  }

  async function createLoyaltyCard(context, input = {}) {
    const clean = validateLoyaltyCardInput(input);
    return queryForTenant(context, async (client) => {
      const code = await generateLoyaltyCardCode(client, context.tenant.tenantId);
      const result = await client.query(
        `
          INSERT INTO marketing_loyalty_cards (
            tenant_id, card_code, title, customer_name, customer_phone, required_stamps,
            current_stamps, reward_type, reward_value, reward_description, status,
            expires_on, created_by_user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::date, $13)
          RETURNING marketing_loyalty_card_id, card_code, title, customer_name, customer_phone,
                    required_stamps, current_stamps, reward_type, reward_value, reward_description,
                    status, expires_on, created_at, updated_at
        `,
        [
          context.tenant.tenantId,
          code,
          clean.title,
          clean.customerName,
          clean.customerPhone,
          clean.requiredStamps,
          clean.currentStamps,
          clean.rewardType,
          clean.rewardValue,
          clean.rewardDescription,
          clean.status,
          clean.expiresOn,
          context.actor.userId,
        ],
      );
      await writeAudit(client, context, "marketing.loyalty_card.created", "marketing_loyalty_card", result.rows[0].marketing_loyalty_card_id, {
        cardCode: code,
        requiredStamps: clean.requiredStamps,
        rewardType: clean.rewardType,
      });
      return mapLoyaltyCard(result.rows[0]);
    });
  }

  async function updateLoyaltyCard(context, loyaltyCardId, input = {}) {
    return queryForTenant(context, async (client) => {
      const current = await requireLoyaltyCardForTenant(client, context.tenant.tenantId, loyaltyCardId);
      const clean = validateLoyaltyCardInput({
        title: input.title ?? current.title,
        customerName: input.customerName ?? input.customer_name ?? current.customer_name,
        customerPhone: input.customerPhone ?? input.customer_phone ?? current.customer_phone,
        requiredStamps: input.requiredStamps ?? input.required_stamps ?? current.required_stamps,
        currentStamps: input.currentStamps ?? input.current_stamps ?? current.current_stamps,
        rewardType: input.rewardType ?? input.reward_type ?? current.reward_type,
        rewardValue: input.rewardValue ?? input.reward_value ?? current.reward_value,
        rewardDescription: input.rewardDescription ?? input.reward_description ?? current.reward_description,
        status: input.status ?? current.status,
        expiresOn: input.expiresOn ?? input.expires_on ?? current.expires_on,
      });
      const result = await client.query(
        `
          UPDATE marketing_loyalty_cards
          SET title = $3,
              customer_name = $4,
              customer_phone = $5,
              required_stamps = $6,
              current_stamps = $7,
              reward_type = $8,
              reward_value = $9,
              reward_description = $10,
              status = $11,
              expires_on = $12::date,
              updated_at = now()
          WHERE tenant_id = $1 AND marketing_loyalty_card_id = $2
          RETURNING marketing_loyalty_card_id, card_code, title, customer_name, customer_phone,
                    required_stamps, current_stamps, reward_type, reward_value, reward_description,
                    status, expires_on, created_at, updated_at
        `,
        [
          context.tenant.tenantId,
          loyaltyCardId,
          clean.title,
          clean.customerName,
          clean.customerPhone,
          clean.requiredStamps,
          clean.currentStamps,
          clean.rewardType,
          clean.rewardValue,
          clean.rewardDescription,
          clean.status,
          clean.expiresOn,
        ],
      );
      await writeAudit(client, context, "marketing.loyalty_card.updated", "marketing_loyalty_card", loyaltyCardId, {
        cardCode: current.card_code,
        currentStamps: clean.currentStamps,
        status: clean.status,
      });
      return mapLoyaltyCard(result.rows[0]);
    });
  }

  return { listCampaigns, createCampaign, listLeads, createLead, convertLead, listLoyaltyCards, createLoyaltyCard, updateLoyaltyCard };
}

async function summarizeLeads(client, tenantId) {
  const result = await client.query(
    `
      SELECT
        count(*)::integer AS total,
        count(*) FILTER (WHERE status = 'new')::integer AS new,
        count(*) FILTER (WHERE status = 'qualified')::integer AS qualified,
        count(*) FILTER (WHERE status = 'converted')::integer AS converted,
        count(*) FILTER (WHERE consent_status = 'accepted')::integer AS consented
      FROM marketing_leads
      WHERE tenant_id = $1
    `,
    [tenantId],
  );
  return {
    total: Number(result.rows[0]?.total || 0),
    new: Number(result.rows[0]?.new || 0),
    qualified: Number(result.rows[0]?.qualified || 0),
    converted: Number(result.rows[0]?.converted || 0),
    consented: Number(result.rows[0]?.consented || 0),
  };
}

async function summarizeLoyaltyCards(client, tenantId) {
  const result = await client.query(
    `
      SELECT
        count(*)::integer AS total,
        count(*) FILTER (WHERE status = 'active')::integer AS active,
        count(*) FILTER (WHERE status = 'redeemed')::integer AS redeemed,
        count(*) FILTER (WHERE current_stamps >= required_stamps AND status = 'active')::integer AS ready
      FROM marketing_loyalty_cards
      WHERE tenant_id = $1
    `,
    [tenantId],
  );
  return {
    total: Number(result.rows[0]?.total || 0),
    active: Number(result.rows[0]?.active || 0),
    redeemed: Number(result.rows[0]?.redeemed || 0),
    ready: Number(result.rows[0]?.ready || 0),
  };
}

async function generateLoyaltyCardCode(client, tenantId) {
  const value = await nextDocumentSequence(client, { tenantId, documentType: "loyalty_card", series: "LOY" });
  return `LOY-${String(value).padStart(6, "0")}`;
}

async function requireCampaignForTenant(client, tenantId, campaignId) {
  const result = await client.query("SELECT marketing_campaign_id FROM marketing_campaigns WHERE tenant_id = $1 AND marketing_campaign_id = $2", [tenantId, campaignId]);
  if (!result.rows[0]) {
    notFound("Campana no encontrada para esta empresa.");
  }
}

async function requireLeadForTenant(client, tenantId, leadId) {
  const result = await client.query(
    `
      SELECT marketing_lead_id, marketing_campaign_id, NULL::text AS campaign_name, name, source,
             service_interest, status, consent_status, converted_client_id, email, phone, notes, created_at, updated_at
      FROM marketing_leads
      WHERE tenant_id = $1 AND marketing_lead_id = $2
    `,
    [tenantId, leadId],
  );
  if (!result.rows[0]) {
    notFound("Lead no encontrado para esta empresa.");
  }
  return result.rows[0];
}

async function requireLoyaltyCardForTenant(client, tenantId, loyaltyCardId) {
  const result = await client.query(
    `
      SELECT marketing_loyalty_card_id, card_code, title, customer_name, customer_phone,
             required_stamps, current_stamps, reward_type, reward_value, reward_description,
             status, expires_on, created_at, updated_at
      FROM marketing_loyalty_cards
      WHERE tenant_id = $1 AND marketing_loyalty_card_id = $2
    `,
    [tenantId, loyaltyCardId],
  );
  if (!result.rows[0]) {
    notFound("Tarjeta de fidelizacion no encontrada para esta empresa.");
  }
  return result.rows[0];
}

async function writeAudit(client, context, action, entityType, entityId, metadata) {
  await client.query(
    `
      INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, $2, $3, 'marketing', $4, $5, 'info', $6::jsonb)
    `,
    [context.tenant.tenantId, context.actor.userId, action, entityType, entityId, JSON.stringify(metadata || {})],
  );
}

function validateCampaignInput(input) {
  return {
    name: requiredText(input.name, 180, "Nombre de campana requerido."),
    channel: requiredText(input.channel || "manual", 80, "Canal requerido."),
    status: validateEnum(input.status || "draft", CAMPAIGN_STATUSES, "Estado de campana no soportado."),
    budgetAmount: nonNegativeNumber(input.budgetAmount ?? input.budget_amount, 0),
  };
}

function validateLeadInput(input) {
  return {
    campaignId: nullableText(input.campaignId || input.marketingCampaignId, 80),
    name: requiredText(input.name, 180, "Nombre del lead requerido."),
    source: requiredText(input.source || "manual", 120, "Fuente requerida."),
    serviceInterest: nullableText(input.serviceInterest || input.service_interest, 180),
    status: validateEnum(input.status || "new", LEAD_STATUSES, "Estado de lead no soportado."),
    consentStatus: validateEnum(input.consentStatus || "pending", CONSENT_STATUSES, "Consentimiento no soportado."),
    email: nullableEmail(input.email),
    phone: nullableText(input.phone, 60),
    notes: nullableText(input.notes, 1000),
  };
}

function validateLoyaltyCardInput(input) {
  const requiredStamps = integerInRange(input.requiredStamps ?? input.required_stamps ?? 10, 1, 100, "Cantidad de sellos no valida.");
  const currentStamps = integerInRange(input.currentStamps ?? input.current_stamps ?? 0, 0, requiredStamps, "Sellos actuales no validos.");
  return {
    title: requiredText(input.title || "Tarjeta de fidelizacion", 180, "Titulo de tarjeta requerido."),
    customerName: nullableText(input.customerName || input.customer_name, 180),
    customerPhone: nullableText(input.customerPhone || input.customer_phone, 60),
    requiredStamps,
    currentStamps,
    rewardType: validateEnum(input.rewardType || input.reward_type || "discount_percent", LOYALTY_REWARD_TYPES, "Tipo de recompensa no soportado."),
    rewardValue: input.rewardValue === "" || input.rewardValue === undefined ? null : nonNegativeNumber(input.rewardValue ?? input.reward_value, 0),
    rewardDescription: requiredText(input.rewardDescription || input.reward_description, 240, "Descripcion de recompensa requerida."),
    status: validateEnum(input.status || "active", LOYALTY_CARD_STATUSES, "Estado de tarjeta no soportado."),
    expiresOn: nullableDate(input.expiresOn || input.expires_on),
  };
}

function mapCampaign(row) {
  return {
    campaignId: row.marketing_campaign_id,
    name: row.name,
    channel: row.channel,
    status: row.status,
    budgetAmount: Number(row.budget_amount || 0),
    leadsCount: Number(row.leads_count || 0),
    conversionsCount: Number(row.conversions_count || 0),
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function mapLead(row) {
  return {
    leadId: row.marketing_lead_id,
    campaignId: row.marketing_campaign_id || null,
    campaignName: row.campaign_name || "",
    name: row.name,
    source: row.source,
    serviceInterest: row.service_interest || "",
    status: row.status,
    consentStatus: row.consent_status,
    convertedClientId: row.converted_client_id || null,
    email: row.email || "",
    phone: row.phone || "",
    notes: row.notes || "",
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function mapLoyaltyCard(row) {
  return {
    loyaltyCardId: row.marketing_loyalty_card_id,
    cardCode: row.card_code,
    title: row.title,
    customerName: row.customer_name || "",
    customerPhone: row.customer_phone || "",
    requiredStamps: Number(row.required_stamps || 0),
    currentStamps: Number(row.current_stamps || 0),
    rewardType: row.reward_type,
    rewardValue: row.reward_value === null || row.reward_value === undefined ? null : Number(row.reward_value),
    rewardDescription: row.reward_description,
    status: row.status,
    expiresOn: row.expires_on?.toISOString?.().slice(0, 10) || row.expires_on || "",
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
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

function integerInRange(value, min, max, message) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    validationError(message);
  }
  return number;
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
