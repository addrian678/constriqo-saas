import { createPostgresPoolFromEnv } from "./postgresAuthRepository.mjs";
import { nextDocumentSequence } from "./documentSequences.mjs";
import { createEmailMetadata, resolveEmailDeliveryConfig } from "./emailDeliveryRuntime.mjs";
import { buildGeneratedStorageKey } from "./storageRuntime.mjs";

const ESTIMATE_STATUSES = new Set(["draft", "sent", "review", "approved", "rejected", "cancelled", "archived"]);
const CURRENCIES = new Set(["USD", "COP", "EUR"]);
const COUNTRIES = new Set(["US", "CO", "ES"]);
const UNIT_SYSTEMS = new Set(["imperial", "metric"]);
const LANGUAGES = new Set(["es", "en"]);
const IMPERIAL_UNITS = new Set(["sq_ft", "linear_ft", "ft", "in", "unit", "hour", "day"]);
const METRIC_UNITS = new Set(["m2", "linear_m", "m", "cm", "unit", "hour", "day"]);
const DEFAULT_CURRENCY = "USD";

export function createPostgresEstimateRepositoryFromEnv(env = process.env) {
  const pool = createPostgresPoolFromEnv(env);
  if (!pool) {
    return null;
  }

  return {
    ...createPostgresEstimateRepository(pool),
    async close() {
      await pool.end();
    },
  };
}

export function createPostgresEstimateRepository(pool) {
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

  async function listEstimates(context, filters = {}) {
    return queryForTenant(context, async (client) => {
      const limit = clampNumber(filters.limit, 1, 100, 25);
      const offset = clampNumber(filters.offset, 0, 10_000, 0);
      const params = [context.tenant.tenantId];
      const where = ["e.tenant_id = $1"];

      if (filters.status && ESTIMATE_STATUSES.has(filters.status)) {
        params.push(filters.status);
        where.push(`e.status = $${params.length}`);
      } else {
        where.push("e.status <> 'archived'");
      }

      if (filters.search) {
        params.push(`%${filters.search.trim().toLowerCase()}%`);
        where.push(
          `(lower(e.estimate_number) LIKE $${params.length} OR lower(c.name) LIKE $${params.length} OR lower(COALESCE(v.snapshot->>'title', '')) LIKE $${params.length})`,
        );
      }

      const whereSql = where.join(" AND ");
      const rows = await client.query(
        `
          SELECT e.estimate_id, e.tenant_id, e.client_id, c.name AS client_name, e.estimate_number, e.status,
                 e.total_amount, e.currency, e.created_at, e.updated_at,
                 v.estimate_version_id, v.version_number, v.subtotal_amount, v.tax_amount, v.total_amount AS version_total,
                 v.snapshot
          FROM estimates e
          JOIN clients c ON c.tenant_id = e.tenant_id AND c.client_id = e.client_id
          LEFT JOIN LATERAL (
            SELECT estimate_version_id, version_number, subtotal_amount, tax_amount, total_amount, snapshot
            FROM estimate_versions
            WHERE tenant_id = e.tenant_id AND estimate_id = e.estimate_id
            ORDER BY version_number DESC
            LIMIT 1
          ) v ON true
          WHERE ${whereSql}
          ORDER BY e.updated_at DESC, e.created_at DESC
          LIMIT $${params.length + 1}
          OFFSET $${params.length + 2}
        `,
        [...params, limit, offset],
      );
      const count = await client.query(`SELECT count(*)::integer AS total FROM estimates e JOIN clients c ON c.tenant_id = e.tenant_id AND c.client_id = e.client_id WHERE ${whereSql}`, params);
      const summary = await client.query(
        `
          SELECT
            count(*) FILTER (WHERE status <> 'archived')::integer AS total,
            count(*) FILTER (WHERE status = 'draft')::integer AS draft,
            count(*) FILTER (WHERE status = 'sent')::integer AS sent,
            count(*) FILTER (WHERE status = 'approved')::integer AS approved,
            count(*) FILTER (WHERE status = 'cancelled')::integer AS cancelled,
            COALESCE(sum(total_amount) FILTER (WHERE status <> 'archived'), 0)::numeric(12,2) AS total_amount
          FROM estimates
          WHERE tenant_id = $1
        `,
        [context.tenant.tenantId],
      );

      return {
        items: rows.rows.map(mapEstimateSummary),
        total: count.rows[0].total,
        limit,
        offset,
        summary: mapEstimateSummaryStats(summary.rows[0]),
      };
    });
  }

  async function getEstimate(context, estimateId) {
    return queryForTenant(context, async (client) => {
      const estimate = await client.query(
        `
          SELECT e.estimate_id, e.tenant_id, e.client_id, c.name AS client_name, e.estimate_number, e.status,
                 e.total_amount, e.currency, e.cost_breakdown, e.template_id, e.company_snapshot, e.project_snapshot,
                 e.created_at, e.updated_at
          FROM estimates e
          JOIN clients c ON c.tenant_id = e.tenant_id AND c.client_id = e.client_id
          WHERE e.tenant_id = $1 AND e.estimate_id = $2
        `,
        [context.tenant.tenantId, estimateId],
      );
      if (!estimate.rows[0]) {
        return null;
      }

      const versions = await client.query(
        `
          SELECT estimate_version_id, version_number, status, subtotal_amount, tax_amount, total_amount, snapshot, created_at
          FROM estimate_versions
          WHERE tenant_id = $1 AND estimate_id = $2
          ORDER BY version_number DESC
        `,
        [context.tenant.tenantId, estimateId],
      );
      const latestVersion = versions.rows[0] || null;
      const sections = latestVersion
        ? await getSectionsForVersion(client, context.tenant.tenantId, latestVersion.estimate_version_id)
        : [];
      const approvals = await client.query(
        `
          SELECT estimate_approval_id, status, approved_by_user_id, approved_at, metadata, created_at
          FROM estimate_approvals
          WHERE tenant_id = $1 AND estimate_id = $2
          ORDER BY created_at DESC
          LIMIT 25
        `,
        [context.tenant.tenantId, estimateId],
      );
      const history = await client.query(
        `
          SELECT action, severity, metadata, created_at
          FROM audit_events
          WHERE tenant_id = $1
            AND module_id = 'estimates'
            AND entity_type = 'estimate'
            AND entity_id = $2
          ORDER BY created_at DESC
          LIMIT 50
        `,
        [context.tenant.tenantId, estimateId],
      );

      return {
        estimate: mapEstimateSummary({ ...estimate.rows[0], snapshot: latestVersion?.snapshot || {}, version_number: latestVersion?.version_number }),
        versions: versions.rows.map(mapVersion),
        sections,
        approvals: approvals.rows.map(mapApproval),
        history: history.rows.map(mapHistory),
      };
    });
  }

  async function createEstimate(context, input) {
    return queryForTenant(context, async (client) => {
      const tenantSettings = await getTenantSettings(client, context.tenant.tenantId);
      const clean = validateEstimateInput(input, { tenantSettings });
      await requireClientForTenant(client, context, clean.clientId);
      const totals = calculateTotals(clean.sections, clean.taxRate, clean.costBreakdown);
      const estimateNumber = clean.estimateNumber || (await generateEstimateNumber(client, context.tenant.tenantId));
      const estimate = await client.query(
        `
          INSERT INTO estimates (tenant_id, client_id, estimate_number, status, total_amount, currency, cost_breakdown, template_id, company_snapshot, project_snapshot)
          VALUES ($1, $2, $3, 'draft', $4, $5, $6::jsonb, $7, $8::jsonb, $9::jsonb)
          RETURNING estimate_id, tenant_id, client_id, estimate_number, status, total_amount, currency,
                    cost_breakdown, template_id, company_snapshot, project_snapshot, created_at, updated_at
        `,
        [
          context.tenant.tenantId,
          clean.clientId,
          estimateNumber,
          totals.total,
          clean.currency,
          JSON.stringify(clean.costBreakdown),
          clean.templateId,
          JSON.stringify(createCompanySnapshot(tenantSettings)),
          JSON.stringify(clean.project),
        ],
      );
      const version = await insertVersion(client, context, estimate.rows[0].estimate_id, 1, clean, totals);
      await writeAudit(client, context, "estimates.created", "estimate", estimate.rows[0].estimate_id, {
        estimateNumber,
        total: totals.total,
      });

      return mapEstimateSummary({
        ...estimate.rows[0],
        client_name: clean.clientName || "",
        snapshot: version.snapshot,
        version_number: 1,
      });
    });
  }

  async function updateEstimate(context, estimateId, input) {
    const clean = validateEstimatePatch(input);
    return queryForTenant(context, async (client) => {
      const current = await client.query(
        "SELECT estimate_id, status FROM estimates WHERE tenant_id = $1 AND estimate_id = $2",
        [context.tenant.tenantId, estimateId],
      );
      if (!current.rows[0]) {
        return null;
      }
      const result = await client.query(
        `
          UPDATE estimates
          SET status = COALESCE($3, status), updated_at = now()
          WHERE tenant_id = $1 AND estimate_id = $2
          RETURNING estimate_id, tenant_id, client_id, estimate_number, status, total_amount, currency, created_at, updated_at
        `,
        [context.tenant.tenantId, estimateId, clean.status],
      );
      await writeAudit(client, context, clean.status ? "estimates.status.updated" : "estimates.updated", "estimate", estimateId, {
        fields: Object.keys(clean).filter((key) => clean[key] !== undefined),
        fromStatus: current.rows[0].status,
        toStatus: clean.status || current.rows[0].status,
      });
      return mapEstimateSummary(result.rows[0]);
    });
  }

  async function createVersion(context, estimateId, input) {
    return queryForTenant(context, async (client) => {
      const tenantSettings = await getTenantSettings(client, context.tenant.tenantId);
      const clean = validateEstimateInput(input, { allowMissingClient: true, tenantSettings });
      const current = await client.query(
        "SELECT estimate_id, client_id FROM estimates WHERE tenant_id = $1 AND estimate_id = $2",
        [context.tenant.tenantId, estimateId],
      );
      if (!current.rows[0]) {
        return null;
      }

      const last = await client.query(
        "SELECT COALESCE(max(version_number), 0)::integer AS version_number FROM estimate_versions WHERE tenant_id = $1 AND estimate_id = $2",
        [context.tenant.tenantId, estimateId],
      );
      const totals = calculateTotals(clean.sections, clean.taxRate, clean.costBreakdown);
      const versionNumber = last.rows[0].version_number + 1;
      const version = await insertVersion(client, context, estimateId, versionNumber, clean, totals);
      await client.query(
        "UPDATE estimates SET total_amount = $3, status = 'draft', updated_at = now() WHERE tenant_id = $1 AND estimate_id = $2",
        [context.tenant.tenantId, estimateId, totals.total],
      );
      await writeAudit(client, context, "estimates.version.created", "estimate", estimateId, { versionNumber });
      return mapVersion(version);
    });
  }

  async function approveEstimate(context, estimateId, input = {}) {
    return queryForTenant(context, async (client) => {
      const current = await client.query(
        "SELECT estimate_id FROM estimates WHERE tenant_id = $1 AND estimate_id = $2",
        [context.tenant.tenantId, estimateId],
      );
      if (!current.rows[0]) {
        return null;
      }

      await client.query(
        "UPDATE estimates SET status = 'approved', updated_at = now() WHERE tenant_id = $1 AND estimate_id = $2",
        [context.tenant.tenantId, estimateId],
      );
      const approval = await client.query(
        `
          INSERT INTO estimate_approvals (tenant_id, estimate_id, approved_by_user_id, status, approved_at, metadata)
          VALUES ($1, $2, $3, 'approved', now(), $4::jsonb)
          RETURNING estimate_approval_id, status, approved_by_user_id, approved_at, metadata, created_at
        `,
        [context.tenant.tenantId, estimateId, context.actor.userId, JSON.stringify({ note: input.note || "" })],
      );
      await writeAudit(client, context, "estimates.approved", "estimate", estimateId, {});
      return mapApproval(approval.rows[0]);
    });
  }

  async function archiveEstimatePdf(context, estimateId, storageSizeBytes = 0) {
    return queryForTenant(context, async (client) => {
      const detail = await getEstimateDetailForClient(client, context.tenant.tenantId, estimateId);
      if (!detail) {
        notFound("Cotizacion no encontrada para esta empresa.");
      }
      const document = await upsertGeneratedDocument(client, context, {
        title: `${detail.estimate.estimateNumber}.pdf`,
        documentType: "estimate_pdf",
        relatedEntityType: "estimate",
        relatedEntityId: estimateId,
        storageKey: buildGeneratedStorageKey({
          tenantId: context.tenant.tenantId,
          documentType: "estimate_pdf",
          relatedEntityType: "estimate",
          relatedEntityId: estimateId,
          filename: `${detail.estimate.estimateNumber}.pdf`,
        }),
        storageSizeBytes,
      });
      await writeAudit(client, context, "estimates.pdf.archived", "estimate", estimateId, {
        documentId: document.documentId,
        storageSizeBytes,
      });
      return { ...detail, document };
    });
  }

  async function recordGeneratedDocumentStorage(context, documentId, storageResult = {}) {
    return queryForTenant(context, async (client) => updateGeneratedDocumentStorage(client, context, documentId, storageResult));
  }

  async function queueEstimateEmail(context, estimateId, input = {}) {
    return queryForTenant(context, async (client) => {
      const detail = await getEstimateDetailForClient(client, context.tenant.tenantId, estimateId);
      if (!detail) {
        notFound("Cotizacion no encontrada para esta empresa.");
      }
      const recipientEmail = normalizeEmail(input.recipientEmail || detail.estimate.clientEmail);
      const subject = nullableText(input.subject, 180) || `Cotizacion ${detail.estimate.estimateNumber}`;
      const bodyText = nullableText(input.bodyText, 4000)
        || `Hola ${detail.estimate.clientName},\n\nTe compartimos la cotizacion ${detail.estimate.estimateNumber} por ${detail.estimate.currency} ${detail.estimate.totalAmount}.\n\nEste envio queda registrado en el historial de comunicaciones de la empresa.`;
      const delivery = await queueEmailDelivery(client, context, {
        recipientEmail,
        recipientName: detail.estimate.clientName,
        subject,
        bodyText,
        templateKey: "estimate.send",
        relatedEntityType: "estimate",
        relatedEntityId: estimateId,
        metadata: {
          estimateNumber: detail.estimate.estimateNumber,
          totalAmount: detail.estimate.totalAmount,
          currency: detail.estimate.currency,
        },
      });
      await client.query(
        `
          UPDATE estimates
          SET status = CASE WHEN status = 'draft' THEN 'sent' ELSE status END,
              updated_at = now()
          WHERE tenant_id = $1 AND estimate_id = $2
        `,
        [context.tenant.tenantId, estimateId],
      );
      await writeAudit(client, context, `estimates.email.${delivery.status}`, "estimate", estimateId, {
        emailDeliveryId: delivery.emailDeliveryId,
        recipientEmail,
      });
      return delivery;
    });
  }

  return {
    listEstimates,
    getEstimate,
    createEstimate,
    updateEstimate,
    createVersion,
    approveEstimate,
    archiveEstimatePdf,
    recordGeneratedDocumentStorage,
    queueEstimateEmail,
  };
}

async function updateGeneratedDocumentStorage(client, context, documentId, storageResult = {}) {
  const result = await client.query(
    `
      UPDATE documents
      SET storage_size_bytes = $3,
          storage_provider = $4,
          storage_uploaded_at = CASE WHEN $5::boolean THEN now() ELSE storage_uploaded_at END,
          storage_checksum_sha256 = $6,
          storage_persisted = $5,
          storage_persist_error = $7,
          updated_at = now()
      WHERE tenant_id = $1 AND document_id = $2
      RETURNING document_id
    `,
    [
      context.tenant.tenantId,
      documentId,
      Math.max(0, Number(storageResult.sizeBytes || 0)),
      storageResult.provider || "not-configured",
      Boolean(storageResult.persisted),
      storageResult.checksumSha256 || null,
      storageResult.persisted ? null : storageResult.reason || null,
    ],
  );
  if (!result.rows[0]) {
    notFound("Documento generado no encontrado para esta empresa.");
  }
  await writeAudit(client, context, "documents.storage.persisted", "document", documentId, {
    provider: storageResult.provider || "not-configured",
    persisted: Boolean(storageResult.persisted),
    sizeBytes: Math.max(0, Number(storageResult.sizeBytes || 0)),
  });
  return { documentId, storageSizeBytes: Math.max(0, Number(storageResult.sizeBytes || 0)) };
}

async function getEstimateDetailForClient(client, tenantId, estimateId) {
  const estimate = await client.query(
    `
      SELECT e.estimate_id, e.tenant_id, e.client_id, c.name AS client_name, c.email AS client_email, e.estimate_number, e.status,
             e.total_amount, e.currency, e.cost_breakdown, e.template_id, e.company_snapshot, e.project_snapshot,
             e.created_at, e.updated_at
      FROM estimates e
      JOIN clients c ON c.tenant_id = e.tenant_id AND c.client_id = e.client_id
      WHERE e.tenant_id = $1 AND e.estimate_id = $2
    `,
    [tenantId, estimateId],
  );
  if (!estimate.rows[0]) {
    return null;
  }
  const versions = await client.query(
    `
      SELECT estimate_version_id, version_number, status, subtotal_amount, tax_amount, total_amount, snapshot, created_at
      FROM estimate_versions
      WHERE tenant_id = $1 AND estimate_id = $2
      ORDER BY version_number DESC
    `,
    [tenantId, estimateId],
  );
  const latestVersion = versions.rows[0] || null;
  const sections = latestVersion ? await getSectionsForVersion(client, tenantId, latestVersion.estimate_version_id) : [];
  const approvals = await client.query(
    `
      SELECT estimate_approval_id, status, approved_by_user_id, approved_at, metadata, created_at
      FROM estimate_approvals
      WHERE tenant_id = $1 AND estimate_id = $2
      ORDER BY created_at DESC
      LIMIT 25
    `,
    [tenantId, estimateId],
  );
  const history = await client.query(
    `
      SELECT action, severity, metadata, created_at
      FROM audit_events
      WHERE tenant_id = $1
        AND module_id = 'estimates'
        AND entity_type = 'estimate'
        AND entity_id = $2
      ORDER BY created_at DESC
      LIMIT 50
    `,
    [tenantId, estimateId],
  );
  return {
    estimate: mapEstimateSummary({ ...estimate.rows[0], snapshot: latestVersion?.snapshot || {}, version_number: latestVersion?.version_number }),
    versions: versions.rows.map(mapVersion),
    sections,
    approvals: approvals.rows.map(mapApproval),
    history: history.rows.map(mapHistory),
  };
}

async function upsertGeneratedDocument(client, context, input) {
  const existing = await client.query(
    `
      SELECT d.document_id
      FROM documents d
      JOIN document_links dl ON dl.tenant_id = d.tenant_id AND dl.document_id = d.document_id
      WHERE d.tenant_id = $1 AND dl.related_entity_type = $2 AND dl.related_entity_id = $3 AND d.document_type = $4
      ORDER BY d.created_at DESC
      LIMIT 1
    `,
    [context.tenant.tenantId, input.relatedEntityType, input.relatedEntityId, input.documentType],
  );
  const documentId = existing.rows[0]?.document_id;
  const document = documentId
    ? await client.query(
        `
          UPDATE documents
          SET title = $3,
              status = 'generated',
              storage_key = $4,
              storage_size_bytes = $5,
              updated_at = now()
          WHERE tenant_id = $1 AND document_id = $2
          RETURNING document_id, title, document_type, status, storage_key, storage_size_bytes
        `,
        [context.tenant.tenantId, documentId, input.title, input.storageKey, input.storageSizeBytes],
      )
    : await client.query(
        `
          INSERT INTO documents (
            tenant_id, title, document_type, status, storage_key,
            related_entity_type, related_entity_id, storage_size_bytes
          )
          VALUES ($1, $2, $3, 'generated', $4, $5, $6, $7)
          RETURNING document_id, title, document_type, status, storage_key, storage_size_bytes
        `,
        [
          context.tenant.tenantId,
          input.title,
          input.documentType,
          input.storageKey,
          input.relatedEntityType,
          input.relatedEntityId,
          input.storageSizeBytes,
        ],
      );
  const row = document.rows[0];
  await client.query(
    `
      INSERT INTO document_links (tenant_id, document_id, related_entity_type, related_entity_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
    `,
    [context.tenant.tenantId, row.document_id, input.relatedEntityType, input.relatedEntityId],
  );
  const version = await client.query(
    "SELECT COALESCE(max(version_number), 0)::integer + 1 AS next_version FROM document_versions WHERE tenant_id = $1 AND document_id = $2",
    [context.tenant.tenantId, row.document_id],
  );
  await client.query(
    `
      INSERT INTO document_versions (tenant_id, document_id, version_number, created_by_user_id)
      VALUES ($1, $2, $3, $4)
    `,
    [context.tenant.tenantId, row.document_id, version.rows[0].next_version, context.actor.userId],
  );
  return {
    documentId: row.document_id,
    title: row.title,
    documentType: row.document_type,
    status: row.status,
    storageKey: row.storage_key,
    storageSizeBytes: Number(row.storage_size_bytes || 0),
    versionNumber: version.rows[0].next_version,
  };
}

async function insertVersion(client, context, estimateId, versionNumber, clean, totals) {
  const snapshot = {
    title: clean.title,
    scope: clean.scope,
    conditions: clean.conditions,
    exclusions: clean.exclusions,
    taxRate: clean.taxRate,
    countryProfile: clean.countryProfile,
    unitSystem: clean.unitSystem,
    currency: clean.currency,
    documentLanguage: clean.documentLanguage,
    costBreakdown: clean.costBreakdown,
    project: clean.project,
    templateId: clean.templateId,
  };
  const version = await client.query(
    `
      INSERT INTO estimate_versions (tenant_id, estimate_id, version_number, status, subtotal_amount, tax_amount, total_amount, snapshot, created_by_user_id)
      VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7::jsonb, $8)
      RETURNING estimate_version_id, version_number, status, subtotal_amount, tax_amount, total_amount, snapshot, created_at
    `,
    [
      context.tenant.tenantId,
      estimateId,
      versionNumber,
      totals.subtotal,
      totals.tax,
      totals.total,
      JSON.stringify(snapshot),
      context.actor.userId,
    ],
  );

  for (const [sectionIndex, section] of clean.sections.entries()) {
    const sectionResult = await client.query(
      `
        INSERT INTO estimate_sections (tenant_id, estimate_version_id, title, sort_order)
        VALUES ($1, $2, $3, $4)
        RETURNING estimate_section_id
      `,
      [context.tenant.tenantId, version.rows[0].estimate_version_id, section.title, sectionIndex],
    );

    for (const item of section.items) {
      const service = item.serviceCatalogItemId
        ? await getActiveServiceForTenant(client, context.tenant.tenantId, item.serviceCatalogItemId)
        : null;
      if (item.serviceCatalogItemId && !service) {
        validationError("El servicio seleccionado no existe para esta empresa o esta archivado.");
      }
      const total = centsToAmount(amountToCents(item.quantity) * amountToCents(item.unitPrice) / 100);
      await client.query(
        `
          INSERT INTO estimate_items (
            tenant_id, estimate_section_id, service_catalog_item_id, description,
            quantity, unit_code, unit_price, total_amount, service_snapshot
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        `,
        [
          context.tenant.tenantId,
          sectionResult.rows[0].estimate_section_id,
          service?.serviceId || null,
          item.description,
          item.quantity,
          item.unitCode,
          item.unitPrice,
          total,
          JSON.stringify(service ? createServiceSnapshot(service) : { unitCode: item.unitCode }),
        ],
      );
    }
  }

  return version.rows[0];
}

async function getSectionsForVersion(client, tenantId, versionId) {
  const sections = await client.query(
    `
      SELECT estimate_section_id, title, sort_order
      FROM estimate_sections
      WHERE tenant_id = $1 AND estimate_version_id = $2
      ORDER BY sort_order, title
    `,
    [tenantId, versionId],
  );

  const result = [];
  for (const section of sections.rows) {
    const items = await client.query(
      `
        SELECT estimate_item_id, service_catalog_item_id, description, quantity, unit_code, unit_price, total_amount, service_snapshot
        FROM estimate_items
        WHERE tenant_id = $1 AND estimate_section_id = $2
        ORDER BY description
      `,
      [tenantId, section.estimate_section_id],
    );
    result.push({
      sectionId: section.estimate_section_id,
      title: section.title,
      sortOrder: section.sort_order,
      items: items.rows.map(mapItem),
    });
  }
  return result;
}

async function requireClientForTenant(client, context, clientId) {
  const result = await client.query("SELECT client_id, name FROM clients WHERE tenant_id = $1 AND client_id = $2", [
    context.tenant.tenantId,
    clientId,
  ]);

  if (!result.rows[0]) {
    const error = new Error("Cliente no encontrado para esta empresa.");
    error.status = 404;
    error.code = "NOT_FOUND";
    throw error;
  }
}

async function generateEstimateNumber(client, tenantId) {
  const value = await nextDocumentSequence(client, { tenantId, documentType: "estimate", series: "EST" });
  return `EST-${String(value).padStart(5, "0")}`;
}

async function writeAudit(client, context, action, entityType, entityId, metadata) {
  await client.query(
    `
      INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, $2, $3, 'estimates', $4, $5, 'info', $6::jsonb)
    `,
    [context.tenant.tenantId, context.actor.userId, action, entityType, entityId, JSON.stringify(metadata || {})],
  );
}

async function queueEmailDelivery(client, context, input) {
  const deliveryConfig = resolveEmailDeliveryConfig();
  const result = await client.query(
    `
      INSERT INTO email_deliveries (
        tenant_id,
        recipient_email,
        recipient_name,
        from_email,
        reply_to_email,
        subject,
        body_text,
        body_html,
        template_key,
        provider,
        status,
        related_entity_type,
        related_entity_id,
        metadata,
        queued_by_user_id,
        sent_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, $9, $10, $11, $12, $13::jsonb, $14, ${deliveryConfig.sentAtSql})
      RETURNING email_delivery_id, recipient_email, subject, template_key, provider, status, queued_at, sent_at
    `,
    [
      context.tenant.tenantId,
      input.recipientEmail,
      input.recipientName || null,
      deliveryConfig.fromEmail,
      deliveryConfig.replyToEmail,
      input.subject,
      input.bodyText,
      input.templateKey,
      deliveryConfig.provider,
      deliveryConfig.status,
      input.relatedEntityType,
      input.relatedEntityId,
      JSON.stringify(createEmailMetadata(input.metadata || {})),
      context.actor.userId,
    ],
  );
  return mapEmailDelivery(result.rows[0]);
}

function mapEmailDelivery(row) {
  return {
    emailDeliveryId: row.email_delivery_id,
    recipientEmail: row.recipient_email,
    subject: row.subject,
    templateKey: row.template_key,
    provider: row.provider,
    status: row.status,
    queuedAt: row.queued_at?.toISOString?.() || row.queued_at,
    sentAt: row.sent_at?.toISOString?.() || row.sent_at,
  };
}

async function getTenantSettings(client, tenantId) {
  const result = await client.query(
    `
      SELECT name, country_profile, unit_system, currency, document_language,
             estimate_template_id, legal_name, tax_id, contractor_license, company_address,
             company_city, company_region, company_postal_code, company_phone, company_email,
             company_website, logo_url, document_company_visibility, document_signature
      FROM tenants
      WHERE tenant_id = $1
    `,
    [tenantId],
  );
  const row = result.rows[0] || {};
  return {
    countryProfile: row.country_profile || "US",
    unitSystem: row.unit_system || "imperial",
    currency: row.currency || DEFAULT_CURRENCY,
    documentLanguage: row.document_language || "es",
    estimateTemplateId: row.estimate_template_id || "estimate_classic_blue",
    companyName: row.name || "",
    legalName: row.legal_name || "",
    taxId: row.tax_id || "",
    contractorLicense: row.contractor_license || "",
    companyAddress: row.company_address || "",
    companyCity: row.company_city || "",
    companyRegion: row.company_region || "",
    companyPostalCode: row.company_postal_code || "",
    companyPhone: row.company_phone || "",
    companyEmail: row.company_email || "",
    companyWebsite: row.company_website || "",
    logoUrl: row.logo_url || "",
    documentCompanyVisibility: row.document_company_visibility || {},
    documentSignature: row.document_signature || {},
  };
}

async function getActiveServiceForTenant(client, tenantId, serviceId) {
  const result = await client.query(
    `
      SELECT service_catalog_item_id, code, name, category, description, country_profile, unit_system,
             unit_code, currency, unit_price, unit_cost, default_tax_rate, margin_percent,
             minimum_quantity, inclusions, exclusions, conditions
      FROM service_catalog_items
      WHERE tenant_id = $1 AND service_catalog_item_id = $2 AND status = 'active'
    `,
    [tenantId, serviceId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
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
    inclusions: row.inclusions || "",
    exclusions: row.exclusions || "",
    conditions: row.conditions || "",
  };
}

function createServiceSnapshot(service) {
  return {
    serviceId: service.serviceId,
    code: service.code,
    name: service.name,
    category: service.category,
    unitCode: service.unitCode,
    unitSystem: service.unitSystem,
    countryProfile: service.countryProfile,
    currency: service.currency,
    unitPrice: service.unitPrice,
    unitCost: service.unitCost,
    defaultTaxRate: service.defaultTaxRate,
    marginPercent: service.marginPercent,
    minimumQuantity: service.minimumQuantity,
    inclusions: service.inclusions,
    exclusions: service.exclusions,
    conditions: service.conditions,
  };
}

function validateEstimateInput(input, options = {}) {
  const tenantSettings = options.tenantSettings || {};
  const sections = Array.isArray(input?.sections) ? input.sections : [];
  if (!options.allowMissingClient && !input?.clientId) {
    validationError("clientId es obligatorio.");
  }

  const clean = {
    clientId: input?.clientId ? String(input.clientId) : "",
    clientName: input?.clientName ? String(input.clientName) : "",
    estimateNumber: nullableText(input?.estimateNumber, 40),
    title: requiredText(input?.title, 180, "El titulo es obligatorio."),
    scope: nullableText(input?.scope, 2000) || "",
    conditions: nullableText(input?.conditions, 2000) || "",
    exclusions: nullableText(input?.exclusions, 2000) || "",
    currency: validateEnum(input?.currency || tenantSettings.currency || DEFAULT_CURRENCY, CURRENCIES, "Moneda no soportada."),
    countryProfile: validateEnum(input?.countryProfile || tenantSettings.countryProfile || "US", COUNTRIES, "Pais/mercado no soportado."),
    unitSystem: validateEnum(input?.unitSystem || tenantSettings.unitSystem || "imperial", UNIT_SYSTEMS, "Sistema de unidades no soportado."),
    documentLanguage: validateEnum(input?.documentLanguage || tenantSettings.documentLanguage || "es", LANGUAGES, "Idioma documental no soportado."),
    taxRate: clampNumber(input?.taxRate, 0, 100, 0),
    templateId: validateEstimateTemplate(input?.templateId || tenantSettings.estimateTemplateId || "estimate_classic_blue"),
    costBreakdown: normalizeCostBreakdown(input?.costBreakdown),
    project: normalizeProjectSnapshot(input?.project),
    sections: sections.map((section) => validateSection(section, tenantSettings)),
  };

  if (clean.sections.length < 1) {
    validationError("La cotizacion debe tener al menos una seccion.");
  }

  return clean;
}

function validateEstimatePatch(input) {
  const status = input?.status === undefined ? undefined : String(input.status);
  if (status && !ESTIMATE_STATUSES.has(status)) {
    validationError("Estado de cotizacion no valido.");
  }
  return { status };
}

function validateSection(section, tenantSettings, index = 0) {
  const items = Array.isArray(section?.items) ? section.items : [];
  if (items.length < 1) {
    validationError(`La seccion ${index + 1} debe tener al menos una partida.`);
  }
  return {
    title: requiredText(section?.title || "General", 140, "El nombre de seccion es obligatorio."),
    items: items.map((item) => validateItem(item, tenantSettings)),
  };
}

function validateItem(item, tenantSettings = {}) {
  const quantity = clampNumber(item?.quantity, 0.01, 1_000_000, 1);
  const unitPrice = clampNumber(item?.unitPrice, 0, 1_000_000_000, 0);
  const unitSystem = validateEnum(item?.unitSystem || tenantSettings.unitSystem || "imperial", UNIT_SYSTEMS, "Sistema de unidades no soportado.");
  const unitCode = validateUnitCode(item?.unitCode || defaultUnitForSystem(unitSystem), unitSystem);
  return {
    serviceCatalogItemId: nullableText(item?.serviceCatalogItemId, 80) || null,
    description: requiredText(item?.description, 240, "La descripcion de partida es obligatoria."),
    quantity,
    unitSystem,
    unitCode,
    unitPrice,
  };
}

function calculateTotals(sections, taxRate, costBreakdown = {}) {
  if (costBreakdown.manualTotal?.enabled) {
    const total = centsToAmount(amountToCents(costBreakdown.manualTotal.amount));
    const tax = centsToAmount(amountToCents(costBreakdown.taxAmount?.amount || 0));
    return { subtotal: centsToAmount(amountToCents(total) - amountToCents(tax)), tax, total };
  }
  if (costBreakdown.enabled) {
    const subtotalCents = [
      "materialsSubtotal",
      "laborSubtotal",
      "equipmentSubtotal",
      "subcontractorsSubtotal",
      "permitsFees",
      "transport",
      "wasteManagement",
      "overhead",
      "contingency",
      "profit",
    ].reduce((total, key) => total + amountToCents(costBreakdown[key]?.amount || 0), 0);
    const discountCents = amountToCents(costBreakdown.discounts?.amount || 0);
    const taxableCents = Math.max(0, subtotalCents - discountCents);
    const taxCents = costBreakdown.taxAmount?.mode === "manual"
      ? amountToCents(costBreakdown.taxAmount.amount)
      : Math.round(taxableCents * (taxRate / 100));
    return {
      subtotal: centsToAmount(taxableCents),
      tax: centsToAmount(taxCents),
      total: centsToAmount(taxableCents + taxCents),
    };
  }
  const subtotalCents = sections.flatMap((section) => section.items).reduce((total, item) => {
    return total + Math.round(item.quantity * amountToCents(item.unitPrice));
  }, 0);
  const taxCents = Math.round(subtotalCents * (taxRate / 100));
  return {
    subtotal: centsToAmount(subtotalCents),
    tax: centsToAmount(taxCents),
    total: centsToAmount(subtotalCents + taxCents),
  };
}

function normalizeCostBreakdown(input = {}) {
  const fields = {
    materialsSubtotal: "Subtotal de materiales",
    laborSubtotal: "Subtotal de mano de obra",
    equipmentSubtotal: "Subtotal de equipos",
    subcontractorsSubtotal: "Subtotal de subcontratistas",
    permitsFees: "Permisos y tasas",
    transport: "Transporte",
    wasteManagement: "Gestion de residuos",
    overhead: "Gastos generales",
    contingency: "Contingencia",
    profit: "Beneficio",
    discounts: "Descuentos",
  };
  const result = { enabled: Boolean(input?.enabled), manualTotal: normalizeBreakdownField(input?.manualTotal, "Total manual"), taxAmount: normalizeBreakdownField(input?.taxAmount, "Impuestos") };
  for (const [key, label] of Object.entries(fields)) {
    result[key] = normalizeBreakdownField(input?.[key], label);
  }
  return result;
}

function normalizeBreakdownField(value = {}, label) {
  return {
    enabled: Boolean(value?.enabled),
    label,
    applies: value?.applies !== false,
    mode: value?.mode === "manual" ? "manual" : "calculated",
    amount: nonNegativeNumber(value?.amount, 0),
  };
}

function normalizeProjectSnapshot(input = {}) {
  return {
    name: nullableText(input?.name, 180) || "",
    address: nullableText(input?.address, 240) || "",
    latitude: nullableNumber(input?.latitude),
    longitude: nullableNumber(input?.longitude),
    overview: nullableText(input?.overview, 2000) || "",
  };
}

function validateEstimateTemplate(value) {
  return validateEnum(value, new Set(["estimate_classic_blue", "estimate_cleaning_teal"]), "Plantilla de cotizacion no soportada.");
}

function createCompanySnapshot(settings = {}) {
  return {
    companyName: settings.companyName || "",
    legalName: settings.legalName || "",
    taxId: settings.taxId || "",
    contractorLicense: settings.contractorLicense || "",
    address: settings.companyAddress || "",
    city: settings.companyCity || "",
    region: settings.companyRegion || "",
    postalCode: settings.companyPostalCode || "",
    phone: settings.companyPhone || "",
    email: settings.companyEmail || "",
    website: settings.companyWebsite || "",
    logoUrl: settings.logoUrl || "",
    visibility: settings.documentCompanyVisibility || {},
    signature: settings.documentSignature || {},
  };
}

function amountToCents(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function centsToAmount(cents) {
  return (Math.round(cents) / 100).toFixed(2);
}

function requiredText(value, maxLength, message) {
  const text = String(value || "").trim();
  if (text.length < 2 || text.length > maxLength) {
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

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    validationError("La cotizacion necesita un correo de cliente valido para preparar el envio.");
  }
  return email;
}

function validateEnum(value, allowed, message) {
  const text = String(value || "").trim();
  if (!allowed.has(text)) {
    validationError(message);
  }
  return text;
}

function defaultUnitForSystem(unitSystem) {
  return unitSystem === "metric" ? "m2" : "sq_ft";
}

function validateUnitCode(value, unitSystem) {
  const text = String(value || "").trim();
  const allowed = unitSystem === "metric" ? METRIC_UNITS : IMPERIAL_UNITS;
  if (!allowed.has(text)) {
    validationError("Unidad no compatible con el sistema de unidades.");
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

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function nonNegativeNumber(value, fallback = 0) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number) || number < 0) {
    validationError("Importe no valido.");
  }
  return Math.round(number * 100) / 100;
}

function nullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mapEstimateSummary(row) {
  const snapshot = row.snapshot || {};
  return {
    estimateId: row.estimate_id,
    clientId: row.client_id,
    clientName: row.client_name || "",
    clientEmail: row.client_email || "",
    estimateNumber: row.estimate_number,
    status: row.status,
    title: snapshot.title || row.estimate_number,
    scope: snapshot.scope || "",
    totalAmount: Number(row.total_amount || row.version_total || 0),
    currency: row.currency || DEFAULT_CURRENCY,
    latestVersion: row.version_number || null,
    costBreakdown: row.cost_breakdown || snapshot.costBreakdown || {},
    templateId: row.template_id || snapshot.templateId || "estimate_classic_blue",
    companySnapshot: row.company_snapshot || {},
    projectSnapshot: row.project_snapshot || snapshot.project || {},
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function mapEstimateSummaryStats(row) {
  return {
    total: row.total || 0,
    draft: row.draft || 0,
    sent: row.sent || 0,
    approved: row.approved || 0,
    cancelled: row.cancelled || 0,
    totalAmount: Number(row.total_amount || 0),
  };
}

function mapVersion(row) {
  return {
    versionId: row.estimate_version_id,
    versionNumber: row.version_number,
    status: row.status,
    subtotalAmount: Number(row.subtotal_amount || 0),
    taxAmount: Number(row.tax_amount || 0),
    totalAmount: Number(row.total_amount || 0),
    snapshot: row.snapshot || {},
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  };
}

function mapItem(row) {
  return {
    itemId: row.estimate_item_id,
    serviceCatalogItemId: row.service_catalog_item_id || null,
    description: row.description,
    quantity: Number(row.quantity || 0),
    unitCode: row.unit_code || "unit",
    unitPrice: Number(row.unit_price || 0),
    totalAmount: Number(row.total_amount || 0),
    serviceSnapshot: row.service_snapshot || {},
  };
}

function mapApproval(row) {
  return {
    approvalId: row.estimate_approval_id,
    status: row.status,
    approvedByUserId: row.approved_by_user_id || "",
    approvedAt: row.approved_at?.toISOString?.() || row.approved_at,
    metadata: row.metadata || {},
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  };
}

function mapHistory(row) {
  return {
    action: row.action,
    severity: row.severity || "info",
    metadata: row.metadata || {},
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  };
}
