import { createPostgresPoolFromEnv } from "./postgresAuthRepository.mjs";
import { nextDocumentSequence } from "./documentSequences.mjs";
import { createEmailMetadata, resolveEmailDeliveryConfig } from "./emailDeliveryRuntime.mjs";
import { createFiscalSnapshot } from "./fiscalProfiles.mjs";
import { buildGeneratedStorageKey } from "./storageRuntime.mjs";

const CURRENCIES = new Set(["USD", "COP", "EUR"]);
const COUNTRIES = new Set(["US", "CO", "ES"]);
const LANGUAGES = new Set(["es", "en"]);
const INVOICE_STATUSES = new Set(["draft", "issued", "sent", "partial", "paid", "overdue", "void"]);
const PAYMENT_METHODS = new Set(["cash", "bank_transfer", "card", "check", "other"]);

const DEFAULT_ACCOUNTS = [
  ["Caja", "cash"],
  ["Banco", "bank"],
  ["Cuentas por cobrar", "receivable"],
  ["Ingresos", "income"],
];

export function createPostgresInvoiceRepositoryFromEnv(env = process.env) {
  const pool = createPostgresPoolFromEnv(env);
  if (!pool) {
    return null;
  }

  return {
    ...createPostgresInvoiceRepository(pool),
    async close() {
      await pool.end();
    },
  };
}

export function createPostgresInvoiceRepository(pool) {
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

  async function listInvoices(context, filters = {}) {
    return queryForTenant(context, async (client) => {
      await markOverdueInvoices(client, context.tenant.tenantId);
      const params = [context.tenant.tenantId];
      const where = ["i.tenant_id = $1"];
      if (filters.status && INVOICE_STATUSES.has(filters.status)) {
        params.push(filters.status);
        where.push(`i.status = $${params.length}`);
      } else {
        where.push("i.status <> 'void'");
      }
      if (filters.search) {
        params.push(`%${String(filters.search).trim().toLowerCase()}%`);
        where.push(`(lower(i.invoice_number) LIKE $${params.length} OR lower(c.name) LIKE $${params.length} OR lower(COALESCE(i.title, '')) LIKE $${params.length})`);
      }
      const result = await client.query(
        `
          SELECT i.invoice_id, i.client_id, c.name AS client_name, c.email AS client_email, i.job_id, j.job_number, j.title AS job_title,
                 i.estimate_id, e.estimate_number, i.invoice_number, i.invoice_type, i.title, i.status,
                 i.subtotal_amount, i.tax_amount, i.discount_amount, i.total_amount, i.balance_amount,
                 i.currency, i.issue_date, i.due_date, i.country_profile, i.document_language,
                 i.billing_snapshot, i.cost_breakdown, i.company_snapshot, i.template_id,
                 i.corrects_invoice_id, ci.invoice_number AS corrects_invoice_number,
                 i.correction_reason, i.pdf_document_id, i.sent_at, i.paid_at, i.created_at, i.updated_at
          FROM invoices i
          JOIN clients c ON c.tenant_id = i.tenant_id AND c.client_id = i.client_id
          LEFT JOIN jobs j ON j.tenant_id = i.tenant_id AND j.job_id = i.job_id
          LEFT JOIN estimates e ON e.tenant_id = i.tenant_id AND e.estimate_id = i.estimate_id
          LEFT JOIN invoices ci ON ci.tenant_id = i.tenant_id AND ci.invoice_id = i.corrects_invoice_id
          WHERE ${where.join(" AND ")}
          ORDER BY i.issue_date DESC, i.created_at DESC
          LIMIT 150
        `,
        params,
      );
      return { items: result.rows.map(mapInvoiceSummary), summary: await summarizeInvoices(client, context.tenant.tenantId) };
    });
  }

  async function getInvoice(context, invoiceId) {
    return queryForTenant(context, async (client) => {
      const invoice = await getInvoiceById(client, context.tenant.tenantId, invoiceId);
      if (!invoice) {
        return null;
      }
      const items = await client.query(
        `
          SELECT invoice_item_id, description, quantity, unit_code, unit_price, tax_amount, total_amount, service_snapshot
          FROM invoice_items
          WHERE tenant_id = $1 AND invoice_id = $2
          ORDER BY created_at NULLS LAST, description
        `,
        [context.tenant.tenantId, invoiceId],
      );
      const payments = await client.query(
        `
          SELECT payment_id, amount, currency, method, status, received_at, reference, notes, receipt_number, document_id, created_at
          FROM payments
          WHERE tenant_id = $1 AND invoice_id = $2
          ORDER BY received_at DESC, created_at DESC
        `,
        [context.tenant.tenantId, invoiceId],
      );
      const history = await client.query(
        `
          SELECT from_status, to_status, changed_at
          FROM invoice_status_history
          WHERE tenant_id = $1 AND invoice_id = $2
          ORDER BY changed_at DESC
        `,
        [context.tenant.tenantId, invoiceId],
      );
      return {
        invoice,
        items: items.rows.map(mapInvoiceItem),
        payments: payments.rows.map(mapPayment),
        history: history.rows.map((row) => ({
          fromStatus: row.from_status || "",
          toStatus: row.to_status,
          changedAt: row.changed_at?.toISOString?.() || row.changed_at,
        })),
      };
    });
  }

  async function createInvoice(context, input = {}) {
    const clean = validateInvoiceInput(input);
    return queryForTenant(context, async (client) => {
      const settings = await getTenantSettings(client, context.tenant.tenantId);
      const invoice = clean.estimateId
        ? await createInvoiceFromEstimate(client, context, clean, settings)
        : await createInvoiceFromItems(client, context, clean, settings);
      await writeAudit(client, context, "invoices.created", "invoice", invoice.invoiceId, {
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.totalAmount,
      });
      return invoice;
    });
  }

  async function issueInvoice(context, invoiceId) {
    return queryForTenant(context, async (client) => {
      const existing = await requireInvoiceRow(client, context.tenant.tenantId, invoiceId);
      if (existing.status === "void") {
        validationError("No se puede emitir una factura anulada.");
      }
      if (existing.status === "paid") {
        validationError("La factura ya esta pagada.");
      }
      if (existing.status !== "draft") {
        validationError("Solo una factura en borrador puede emitirse.");
      }
      await ensureDefaultAccounts(client, context.tenant.tenantId, existing.currency);
      await applyInvoiceStatusChange(client, context, invoiceId, existing.status, "issued");
      await postInvoiceLedger(client, context, {
        invoiceId,
        amount: Number(existing.total_amount || 0),
        currency: existing.currency,
        occurredAt: existing.issue_date,
        description: `Factura ${existing.invoice_number}`,
      });
      await writeAudit(client, context, "invoices.issued", "invoice", invoiceId, {});
      return getInvoiceById(client, context.tenant.tenantId, invoiceId);
    });
  }

  async function updateInvoiceStatus(context, invoiceId, input = {}) {
    validateEnum(input.status, INVOICE_STATUSES, "Estado de factura no soportado.");
    validationError("El estado de factura solo puede cambiar mediante comandos explicitos: emitir, cobrar, anular o rectificar.");
  }

  async function recordPayment(context, invoiceId, input = {}) {
    const clean = validatePaymentInput(input);
    return queryForTenant(context, async (client) => {
      const existing = await requireInvoiceRowForUpdate(client, context.tenant.tenantId, invoiceId);
      if (existing.status === "void") {
        validationError("No se puede cobrar una factura anulada.");
      }
      const currentBalance = Number(existing.balance_amount || 0);
      if (currentBalance <= 0) {
        validationError("La factura no tiene saldo pendiente.");
      }
      if (clean.amount > currentBalance) {
        validationError("El cobro supera el saldo pendiente. Registra un credito explicito si corresponde.");
      }
      const amount = clean.amount;
      const idempotencyKey = clean.idempotencyKey || `invoice:${invoiceId}:${context.actor.userId}:${amount}:${clean.receivedAt}:${clean.reference || ""}`;
      const existingPayment = await client.query(
        `
          SELECT payment_id, amount, currency, method, status, received_at, reference, notes, receipt_number, document_id, created_at
          FROM payments
          WHERE tenant_id = $1 AND idempotency_key = $2
          LIMIT 1
        `,
        [context.tenant.tenantId, idempotencyKey],
      );
      if (existingPayment.rows[0]) {
        return { invoice: await getInvoiceById(client, context.tenant.tenantId, invoiceId), payment: mapPayment(existingPayment.rows[0]) };
      }
      const payment = await client.query(
        `
          INSERT INTO payments (tenant_id, invoice_id, amount, currency, method, status, received_at, reference, notes, receipt_number, recorded_by_user_id, idempotency_key)
          VALUES ($1, $2, $3, $4, $5, 'recorded', $6::timestamptz, $7, $8, $9, $10, $11)
          RETURNING payment_id, amount, currency, method, status, received_at, reference, notes, receipt_number, document_id, created_at
        `,
        [
          context.tenant.tenantId,
          invoiceId,
          amount,
          existing.currency,
          clean.method,
          clean.receivedAt,
          clean.reference,
          clean.notes,
          await generateReceiptNumber(client, context.tenant.tenantId),
          context.actor.userId,
          idempotencyKey,
        ],
      );
      const nextBalance = Math.round((currentBalance - amount) * 100) / 100;
      const nextStatus = nextBalance <= 0 ? "paid" : "partial";
      await client.query(
        `
          UPDATE invoices
          SET balance_amount = $3::numeric,
              status = $4,
              paid_at = CASE WHEN $4 = 'paid' THEN now() ELSE paid_at END,
              updated_at = now()
          WHERE tenant_id = $1 AND invoice_id = $2
        `,
        [context.tenant.tenantId, invoiceId, nextBalance, nextStatus],
      );
      await client.query(
        `
          INSERT INTO invoice_status_history (tenant_id, invoice_id, from_status, to_status, changed_by_user_id)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [context.tenant.tenantId, invoiceId, existing.status, nextStatus, context.actor.userId],
      );
      await postPaymentLedger(client, context, {
        invoiceId,
        amount,
        currency: existing.currency,
        occurredAt: clean.receivedAt,
        description: `Cobro factura ${existing.invoice_number}`,
      });
      await writeAudit(client, context, "payments.recorded", "payment", payment.rows[0].payment_id, { invoiceId, amount });
      return { invoice: await getInvoiceById(client, context.tenant.tenantId, invoiceId), payment: mapPayment(payment.rows[0]) };
    });
  }

  async function archiveInvoicePdf(context, invoiceId) {
    return queryForTenant(context, async (client) => {
      const detail = await getInvoiceDetailForClient(client, context.tenant.tenantId, invoiceId);
      if (!detail) {
        notFound("Factura no encontrada para esta empresa.");
      }
      const document = await upsertGeneratedDocument(client, context, {
        title: `${detail.invoice.invoiceNumber}.pdf`,
        documentType: detail.invoice.invoiceType === "credit_note" ? "credit_note_pdf" : "invoice_pdf",
        relatedEntityType: "invoice",
        relatedEntityId: invoiceId,
        storageKey: buildGeneratedStorageKey({
          tenantId: context.tenant.tenantId,
          documentType: detail.invoice.invoiceType === "credit_note" ? "credit_note_pdf" : "invoice_pdf",
          relatedEntityType: "invoice",
          relatedEntityId: invoiceId,
          filename: `${detail.invoice.invoiceNumber}.pdf`,
        }),
      });
      await client.query(
        "UPDATE invoices SET pdf_document_id = $3, updated_at = now() WHERE tenant_id = $1 AND invoice_id = $2",
        [context.tenant.tenantId, invoiceId, document.documentId],
      );
      await writeAudit(client, context, "invoices.pdf.archived", "invoice", invoiceId, { documentId: document.documentId });
      return { ...detail, document };
    });
  }

  async function archiveReceiptPdf(context, invoiceId, paymentId) {
    return queryForTenant(context, async (client) => {
      const detail = await getInvoiceDetailForClient(client, context.tenant.tenantId, invoiceId);
      if (!detail) {
        notFound("Factura no encontrada para esta empresa.");
      }
      const payment = await getPaymentRow(client, context.tenant.tenantId, invoiceId, paymentId);
      const document = await upsertGeneratedDocument(client, context, {
        title: `${payment.receipt_number || payment.payment_id}.pdf`,
        documentType: "payment_receipt_pdf",
        relatedEntityType: "payment",
        relatedEntityId: payment.payment_id,
        storageKey: buildGeneratedStorageKey({
          tenantId: context.tenant.tenantId,
          documentType: "payment_receipt_pdf",
          relatedEntityType: "payment",
          relatedEntityId: payment.payment_id,
          filename: `${payment.receipt_number || payment.payment_id}.pdf`,
        }),
      });
      await client.query("UPDATE payments SET document_id = $4 WHERE tenant_id = $1 AND invoice_id = $2 AND payment_id = $3", [
        context.tenant.tenantId,
        invoiceId,
        payment.payment_id,
        document.documentId,
      ]);
      await writeAudit(client, context, "payments.receipt.pdf.archived", "payment", payment.payment_id, { documentId: document.documentId });
      return { ...detail, payment: mapPayment({ ...payment, document_id: document.documentId }), document };
    });
  }

  async function createCreditNote(context, invoiceId, input = {}) {
    const clean = validateCreditNoteInput(input);
    return queryForTenant(context, async (client) => {
      const original = await requireInvoiceRow(client, context.tenant.tenantId, invoiceId);
      if (!["issued", "sent", "partial", "overdue"].includes(original.status)) {
        validationError("Solo se puede rectificar una factura emitida con saldo abierto.");
      }
      const originalBalance = Number(original.balance_amount || 0);
      if (originalBalance <= 0) {
        validationError("La factura no tiene saldo pendiente para rectificar.");
      }
      const amount = Math.min(clean.amount, originalBalance);
      const settings = await getTenantSettings(client, context.tenant.tenantId);
      const creditNumber = await generateCreditNoteNumber(client, context.tenant.tenantId);
      const creditNote = await insertInvoice(client, context, {
        clientId: original.client_id,
        jobId: original.job_id,
        estimateId: original.estimate_id,
        invoiceNumber: creditNumber,
        invoiceType: "credit_note",
        title: clean.title || `Rectificativa ${original.invoice_number}`,
        status: "issued",
        subtotalAmount: -amount,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: -amount,
        balanceAmount: 0,
        currency: original.currency,
        issueDate: clean.issueDate,
        dueDate: null,
        countryProfile: original.country_profile,
        documentLanguage: original.document_language,
        correctsInvoiceId: invoiceId,
        correctionReason: clean.reason,
    billingSnapshot: createBillingSnapshot({
          settings,
          countryProfile: original.country_profile,
          documentLanguage: original.document_language,
          source: "credit_note",
          estimateNumber: null,
        }),
        costBreakdown: {},
        companySnapshot: createCompanySnapshot(settings),
        templateId: original.template_id || settings.invoiceTemplateId || "invoice_clean_red",
      });
      await insertInvoiceItem(client, context.tenant.tenantId, creditNote.invoiceId, {
        description: clean.reason,
        quantity: 1,
        unitCode: "unit",
        unitPrice: -amount,
        taxAmount: 0,
        totalAmount: -amount,
        serviceSnapshot: { correctsInvoiceId: invoiceId, correctsInvoiceNumber: original.invoice_number },
      });
      const nextBalance = Math.round((originalBalance - amount) * 100) / 100;
      await client.query(
        "UPDATE invoices SET balance_amount = $3::numeric, status = CASE WHEN $3::numeric <= 0 THEN 'paid' ELSE status END, updated_at = now() WHERE tenant_id = $1 AND invoice_id = $2",
        [context.tenant.tenantId, invoiceId, nextBalance],
      );
      await postCreditNoteLedger(client, context, {
        invoiceId: creditNote.invoiceId,
        amount,
        currency: original.currency,
        occurredAt: clean.issueDate,
        description: `Rectificativa ${creditNumber} de ${original.invoice_number}`,
      });
      await writeAudit(client, context, "invoices.credit_note.created", "invoice", creditNote.invoiceId, {
        correctsInvoiceId: invoiceId,
        amount,
      });
      return creditNote;
    });
  }

  async function recordGeneratedDocumentSize(context, documentId, storageSizeBytes = 0) {
    return recordGeneratedDocumentStorage(context, documentId, {
      provider: "not-configured",
      persisted: false,
      sizeBytes: storageSizeBytes,
      reason: "Legacy size-only update.",
    });
  }

  async function recordGeneratedDocumentStorage(context, documentId, storageResult = {}) {
    const size = Math.max(0, Math.min(10_737_418_240, Number(storageResult.sizeBytes) || 0));
    return queryForTenant(context, async (client) => {
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
          size,
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
        sizeBytes: Math.max(0, Math.min(10_737_418_240, Number(storageResult.sizeBytes) || 0)),
      });
      return { documentId, storageSizeBytes: size };
    });
  }

  async function queueInvoiceEmail(context, invoiceId, input = {}) {
    return queryForTenant(context, async (client) => {
      const detail = await getInvoiceDetailForClient(client, context.tenant.tenantId, invoiceId);
      if (!detail) {
        notFound("Factura no encontrada para esta empresa.");
      }
      const recipientEmail = normalizeEmail(input.recipientEmail || detail.invoice.clientEmail);
      const subject = nullableText(input.subject, 180) || `Factura ${detail.invoice.invoiceNumber}`;
      const bodyText = nullableText(input.bodyText, 4000)
        || `Hola ${detail.invoice.clientName},\n\nTe compartimos la factura ${detail.invoice.invoiceNumber} por ${detail.invoice.currency} ${detail.invoice.totalAmount}.\n\nEste envio queda registrado en el historial de comunicaciones de la empresa.`;
      const delivery = await queueEmailDelivery(client, context, {
        recipientEmail,
        recipientName: detail.invoice.clientName,
        subject,
        bodyText,
        templateKey: "invoice.send",
        relatedEntityType: "invoice",
        relatedEntityId: invoiceId,
        metadata: {
          invoiceNumber: detail.invoice.invoiceNumber,
          totalAmount: detail.invoice.totalAmount,
          balanceAmount: detail.invoice.balanceAmount,
          currency: detail.invoice.currency,
        },
      });
      await client.query(
        `
          UPDATE invoices
          SET status = CASE WHEN status = 'issued' THEN 'sent' ELSE status END,
              sent_at = COALESCE(sent_at, now()),
              updated_at = now()
          WHERE tenant_id = $1 AND invoice_id = $2
        `,
        [context.tenant.tenantId, invoiceId],
      );
      await writeAudit(client, context, `invoices.email.${delivery.status}`, "invoice", invoiceId, {
        emailDeliveryId: delivery.emailDeliveryId,
        recipientEmail,
      });
      return delivery;
    });
  }

  return {
    listInvoices,
    getInvoice,
    createInvoice,
    issueInvoice,
    updateInvoiceStatus,
    recordPayment,
    archiveInvoicePdf,
    archiveReceiptPdf,
    createCreditNote,
    recordGeneratedDocumentSize,
    recordGeneratedDocumentStorage,
    queueInvoiceEmail,
  };
}

async function createInvoiceFromEstimate(client, context, clean, settings) {
  const estimate = await client.query(
    `
      SELECT e.estimate_id, e.client_id, e.estimate_number, e.status, e.total_amount, e.currency,
             e.cost_breakdown, e.company_snapshot, e.template_id,
             v.estimate_version_id, v.subtotal_amount, v.tax_amount, v.total_amount AS version_total, v.snapshot
      FROM estimates e
      LEFT JOIN LATERAL (
        SELECT estimate_version_id, subtotal_amount, tax_amount, total_amount, snapshot
        FROM estimate_versions
        WHERE tenant_id = e.tenant_id AND estimate_id = e.estimate_id
        ORDER BY version_number DESC
        LIMIT 1
      ) v ON true
      WHERE e.tenant_id = $1 AND e.estimate_id = $2
    `,
    [context.tenant.tenantId, clean.estimateId],
  );
  const row = estimate.rows[0];
  if (!row) {
    notFound("Cotizacion no encontrada para esta empresa.");
  }
  if (row.status !== "approved") {
    validationError("Solo se puede facturar una cotizacion aprobada.");
  }
  const snapshot = row.snapshot || {};
  const countryProfile = clean.countryProfile || snapshot.countryProfile || settings.countryProfile;
  const documentLanguage = clean.documentLanguage || snapshot.documentLanguage || settings.documentLanguage;
  const currency = clean.currency || row.currency || settings.currency;
  const invoiceNumber = clean.invoiceNumber || (await generateInvoiceNumber(client, context.tenant.tenantId));
  const subtotal = Number(row.subtotal_amount || row.total_amount || 0);
  const tax = Number(row.tax_amount || 0);
  const total = Number(row.version_total || row.total_amount || subtotal + tax);
  const invoice = await insertInvoice(client, context, {
    clientId: row.client_id,
    jobId: clean.jobId,
    estimateId: row.estimate_id,
    invoiceNumber,
    title: clean.title || snapshot.title || `Factura ${row.estimate_number}`,
    status: "draft",
    subtotalAmount: subtotal,
    taxAmount: tax,
    discountAmount: 0,
    totalAmount: total,
    balanceAmount: total,
    currency,
    issueDate: clean.issueDate,
    dueDate: clean.dueDate,
    countryProfile,
    documentLanguage,
    billingSnapshot: createBillingSnapshot({ settings, countryProfile, documentLanguage, source: "estimate", estimateNumber: row.estimate_number }),
    costBreakdown: row.cost_breakdown || {},
    companySnapshot: row.company_snapshot || createCompanySnapshot(settings),
    templateId: settings.invoiceTemplateId || "invoice_clean_red",
  });
  await copyEstimateItemsToInvoice(client, context.tenant.tenantId, row.estimate_version_id, invoice.invoiceId);
  return invoice;
}

async function createInvoiceFromItems(client, context, clean, settings) {
  await requireClientForTenant(client, context.tenant.tenantId, clean.clientId);
  if (clean.jobId) {
    await requireJobForTenant(client, context.tenant.tenantId, clean.jobId);
  }
  const subtotal = clean.items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPrice * 100) / 100, 0);
  const tax = clean.items.reduce((sum, item) => sum + item.taxAmount, 0);
  const total = Math.round((subtotal + tax - clean.discountAmount) * 100) / 100;
  const invoiceNumber = clean.invoiceNumber || (await generateInvoiceNumber(client, context.tenant.tenantId));
  const countryProfile = clean.countryProfile || settings.countryProfile;
  const documentLanguage = clean.documentLanguage || settings.documentLanguage;
  const invoice = await insertInvoice(client, context, {
    clientId: clean.clientId,
    jobId: clean.jobId,
    estimateId: null,
    invoiceNumber,
    title: clean.title || invoiceNumber,
    status: "draft",
    subtotalAmount: subtotal,
    taxAmount: tax,
    discountAmount: clean.discountAmount,
    totalAmount: total,
    balanceAmount: total,
    currency: clean.currency || settings.currency,
    issueDate: clean.issueDate,
    dueDate: clean.dueDate,
    countryProfile,
    documentLanguage,
    billingSnapshot: createBillingSnapshot({ settings, countryProfile, documentLanguage, source: "manual" }),
    costBreakdown: clean.costBreakdown,
    companySnapshot: createCompanySnapshot(settings),
    templateId: clean.templateId || settings.invoiceTemplateId || "invoice_clean_red",
  });
  for (const item of clean.items) {
    await insertInvoiceItem(client, context.tenant.tenantId, invoice.invoiceId, item);
  }
  return invoice;
}

async function insertInvoice(client, context, input) {
  const result = await client.query(
    `
      INSERT INTO invoices (
        tenant_id, client_id, job_id, estimate_id, invoice_number, invoice_type, title, status,
        subtotal_amount, tax_amount, discount_amount, total_amount, balance_amount, currency,
        issue_date, due_date, country_profile, document_language, billing_snapshot, corrects_invoice_id, correction_reason
        , cost_breakdown, company_snapshot, template_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19::jsonb, $20, $21, $22::jsonb, $23::jsonb, $24)
      RETURNING invoice_id
    `,
    [
      context.tenant.tenantId,
      input.clientId,
      input.jobId,
      input.estimateId,
      input.invoiceNumber,
      input.invoiceType || "standard",
      input.title,
      input.status,
      input.subtotalAmount,
      input.taxAmount,
      input.discountAmount,
      input.totalAmount,
      input.balanceAmount,
      input.currency,
      input.issueDate,
      input.dueDate,
      input.countryProfile,
      input.documentLanguage,
      JSON.stringify(input.billingSnapshot),
      input.correctsInvoiceId || null,
      input.correctionReason || null,
      JSON.stringify(input.costBreakdown || {}),
      JSON.stringify(input.companySnapshot || {}),
      input.templateId || "invoice_clean_red",
    ],
  );
  await client.query(
    `
      INSERT INTO invoice_status_history (tenant_id, invoice_id, from_status, to_status, changed_by_user_id)
      VALUES ($1, $2, NULL, $3, $4)
    `,
    [context.tenant.tenantId, result.rows[0].invoice_id, input.status, context.actor.userId],
  );
  return getInvoiceById(client, context.tenant.tenantId, result.rows[0].invoice_id);
}

async function copyEstimateItemsToInvoice(client, tenantId, versionId, invoiceId) {
  if (!versionId) {
    return;
  }
  const sections = await client.query("SELECT estimate_section_id FROM estimate_sections WHERE tenant_id = $1 AND estimate_version_id = $2", [tenantId, versionId]);
  for (const section of sections.rows) {
    const items = await client.query(
      `
        SELECT description, quantity, unit_code, unit_price, total_amount, service_snapshot
        FROM estimate_items
        WHERE tenant_id = $1 AND estimate_section_id = $2
      `,
      [tenantId, section.estimate_section_id],
    );
    for (const item of items.rows) {
      await insertInvoiceItem(client, tenantId, invoiceId, {
        description: item.description,
        quantity: Number(item.quantity || 0),
        unitCode: item.unit_code || "unit",
        unitPrice: Number(item.unit_price || 0),
        taxAmount: 0,
        totalAmount: Number(item.total_amount || 0),
        serviceSnapshot: item.service_snapshot || {},
      });
    }
  }
}

async function insertInvoiceItem(client, tenantId, invoiceId, item) {
  const total = item.totalAmount ?? Math.round(item.quantity * item.unitPrice * 100) / 100;
  await client.query(
    `
      INSERT INTO invoice_items (tenant_id, invoice_id, description, quantity, unit_code, unit_price, tax_amount, total_amount, service_snapshot)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
    `,
    [tenantId, invoiceId, item.description, item.quantity, item.unitCode || "unit", item.unitPrice, item.taxAmount || 0, total, JSON.stringify(item.serviceSnapshot || {})],
  );
}

async function getInvoiceById(client, tenantId, invoiceId) {
  const result = await client.query(
    `
      SELECT i.invoice_id, i.client_id, c.name AS client_name, c.email AS client_email, i.job_id, j.job_number, j.title AS job_title,
             i.estimate_id, e.estimate_number, i.invoice_number, i.invoice_type, i.title, i.status,
             i.subtotal_amount, i.tax_amount, i.discount_amount, i.total_amount, i.balance_amount,
             i.currency, i.issue_date, i.due_date, i.country_profile, i.document_language,
             i.billing_snapshot, i.cost_breakdown, i.company_snapshot, i.template_id,
             i.corrects_invoice_id, ci.invoice_number AS corrects_invoice_number,
             i.correction_reason, i.pdf_document_id, i.sent_at, i.paid_at, i.created_at, i.updated_at
      FROM invoices i
      JOIN clients c ON c.tenant_id = i.tenant_id AND c.client_id = i.client_id
      LEFT JOIN jobs j ON j.tenant_id = i.tenant_id AND j.job_id = i.job_id
      LEFT JOIN estimates e ON e.tenant_id = i.tenant_id AND e.estimate_id = i.estimate_id
      LEFT JOIN invoices ci ON ci.tenant_id = i.tenant_id AND ci.invoice_id = i.corrects_invoice_id
      WHERE i.tenant_id = $1 AND i.invoice_id = $2
    `,
    [tenantId, invoiceId],
  );
  return result.rows[0] ? mapInvoiceSummary(result.rows[0]) : null;
}

async function getInvoiceDetailForClient(client, tenantId, invoiceId) {
  const invoice = await getInvoiceById(client, tenantId, invoiceId);
  if (!invoice) {
    return null;
  }
  const items = await client.query(
    `
      SELECT invoice_item_id, description, quantity, unit_code, unit_price, tax_amount, total_amount, service_snapshot
      FROM invoice_items
      WHERE tenant_id = $1 AND invoice_id = $2
      ORDER BY created_at NULLS LAST, description
    `,
    [tenantId, invoiceId],
  );
  const payments = await client.query(
    `
      SELECT payment_id, amount, currency, method, status, received_at, reference, notes, receipt_number, document_id, created_at
      FROM payments
      WHERE tenant_id = $1 AND invoice_id = $2
      ORDER BY received_at DESC, created_at DESC
    `,
    [tenantId, invoiceId],
  );
  return {
    invoice,
    items: items.rows.map(mapInvoiceItem),
    payments: payments.rows.map(mapPayment),
  };
}

async function getPaymentRow(client, tenantId, invoiceId, paymentId) {
  const result = await client.query(
    `
      SELECT payment_id, amount, currency, method, status, received_at, reference, notes, receipt_number, document_id, created_at
      FROM payments
      WHERE tenant_id = $1 AND invoice_id = $2 AND payment_id = $3
    `,
    [tenantId, invoiceId, paymentId],
  );
  if (!result.rows[0]) {
    notFound("Pago no encontrado para esta empresa.");
  }
  return result.rows[0];
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
              storage_size_bytes = COALESCE($5, storage_size_bytes),
              updated_at = now()
          WHERE tenant_id = $1 AND document_id = $2
          RETURNING document_id, title, document_type, status, storage_key, storage_size_bytes
        `,
        [context.tenant.tenantId, documentId, input.title, input.storageKey, input.storageSizeBytes ?? null],
      )
    : await client.query(
        `
          INSERT INTO documents (tenant_id, title, document_type, status, storage_key, related_entity_type, related_entity_id, storage_size_bytes)
          VALUES ($1, $2, $3, 'generated', $4, $5, $6, $7)
          RETURNING document_id, title, document_type, status, storage_key, storage_size_bytes
        `,
        [context.tenant.tenantId, input.title, input.documentType, input.storageKey, input.relatedEntityType, input.relatedEntityId, input.storageSizeBytes || 0],
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

async function requireInvoiceRow(client, tenantId, invoiceId) {
  const result = await client.query("SELECT * FROM invoices WHERE tenant_id = $1 AND invoice_id = $2", [tenantId, invoiceId]);
  if (!result.rows[0]) {
    notFound("Factura no encontrada para esta empresa.");
  }
  return result.rows[0];
}

async function requireInvoiceRowForUpdate(client, tenantId, invoiceId) {
  const result = await client.query("SELECT * FROM invoices WHERE tenant_id = $1 AND invoice_id = $2 FOR UPDATE", [tenantId, invoiceId]);
  if (!result.rows[0]) {
    notFound("Factura no encontrada para esta empresa.");
  }
  return result.rows[0];
}

async function requireClientForTenant(client, tenantId, clientId) {
  const result = await client.query("SELECT client_id FROM clients WHERE tenant_id = $1 AND client_id = $2", [tenantId, clientId]);
  if (!result.rows[0]) {
    notFound("Cliente no encontrado para esta empresa.");
  }
}

async function requireJobForTenant(client, tenantId, jobId) {
  const result = await client.query("SELECT job_id FROM jobs WHERE tenant_id = $1 AND job_id = $2", [tenantId, jobId]);
  if (!result.rows[0]) {
    notFound("Obra no encontrada para esta empresa.");
  }
}

async function generateInvoiceNumber(client, tenantId) {
  const fiscalYear = new Date().getFullYear();
  const value = await nextDocumentSequence(client, { tenantId, documentType: "invoice", series: "INV", fiscalYear });
  return `INV-${fiscalYear}-${String(value).padStart(5, "0")}`;
}

async function generateCreditNoteNumber(client, tenantId) {
  const fiscalYear = new Date().getFullYear();
  const value = await nextDocumentSequence(client, { tenantId, documentType: "credit_note", series: "CN", fiscalYear });
  return `CN-${fiscalYear}-${String(value).padStart(5, "0")}`;
}

async function generateReceiptNumber(client, tenantId) {
  const fiscalYear = new Date().getFullYear();
  const value = await nextDocumentSequence(client, { tenantId, documentType: "receipt", series: "RCPT", fiscalYear });
  return `RCPT-${fiscalYear}-${String(value).padStart(5, "0")}`;
}

async function applyInvoiceStatusChange(client, context, invoiceId, fromStatus, toStatus) {
  await client.query(
    `
      UPDATE invoices
      SET status = $3,
          sent_at = CASE WHEN $3 IN ('issued', 'sent') THEN COALESCE(sent_at, now()) ELSE sent_at END,
          voided_at = CASE WHEN $3 = 'void' THEN now() ELSE voided_at END,
          updated_at = now()
      WHERE tenant_id = $1 AND invoice_id = $2
    `,
    [context.tenant.tenantId, invoiceId, toStatus],
  );
  await client.query(
    `
      INSERT INTO invoice_status_history (tenant_id, invoice_id, from_status, to_status, changed_by_user_id)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [context.tenant.tenantId, invoiceId, fromStatus, toStatus, context.actor.userId],
  );
}

async function markOverdueInvoices(client, tenantId) {
  await client.query(
    `
      UPDATE invoices
      SET status = 'overdue', updated_at = now()
      WHERE tenant_id = $1
        AND status IN ('issued', 'sent', 'partial')
        AND balance_amount > 0
        AND due_date IS NOT NULL
        AND due_date < CURRENT_DATE
    `,
    [tenantId],
  );
}

async function summarizeInvoices(client, tenantId) {
  const result = await client.query(
    `
      SELECT
        COALESCE(sum(total_amount) FILTER (WHERE status <> 'void'), 0)::numeric AS total,
        COALESCE(sum(balance_amount) FILTER (WHERE status <> 'void'), 0)::numeric AS open,
        COALESCE(sum(balance_amount) FILTER (WHERE status = 'overdue'), 0)::numeric AS overdue,
        COALESCE(sum(total_amount - balance_amount) FILTER (WHERE status <> 'void'), 0)::numeric AS collected,
        count(*) FILTER (WHERE status = 'draft')::integer AS drafts,
        count(*) FILTER (WHERE status IN ('issued', 'sent'))::integer AS issued,
        count(*) FILTER (WHERE status = 'paid')::integer AS paid
      FROM invoices
      WHERE tenant_id = $1
    `,
    [tenantId],
  );
  const row = result.rows[0] || {};
  return {
    total: Number(row.total || 0),
    open: Number(row.open || 0),
    overdue: Number(row.overdue || 0),
    collected: Number(row.collected || 0),
    drafts: Number(row.drafts || 0),
    issued: Number(row.issued || 0),
    paid: Number(row.paid || 0),
  };
}

async function getTenantSettings(client, tenantId) {
  const result = await client.query(
    `SELECT name, currency, country_profile, unit_system, document_language, locale,
            invoice_template_id, legal_name, tax_id, contractor_license, company_address,
            company_city, company_region, company_postal_code, company_phone, company_email,
            company_website, logo_url, document_company_visibility, document_signature
     FROM tenants WHERE tenant_id = $1`,
    [tenantId],
  );
  const row = result.rows[0] || {};
  return {
    companyName: row.name || "",
    currency: row.currency || "USD",
    countryProfile: row.country_profile || "US",
    unitSystem: row.unit_system || "imperial",
    documentLanguage: row.document_language || "es",
    locale: row.locale || "es-US",
    invoiceTemplateId: row.invoice_template_id || "invoice_clean_red",
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

function createBillingSnapshot({ settings, countryProfile, documentLanguage, source, estimateNumber }) {
  const fiscalProfile = createFiscalSnapshot({
    countryProfile,
    regionCode: settings.companyRegion || "",
  });
  return {
    source,
    estimateNumber: estimateNumber || null,
    companyName: settings.companyName,
    countryProfile,
    documentLanguage,
    locale: settings.locale,
    fiscalProfile,
    requiresExternalProvider: fiscalProfile.requiresExternalProvider,
    requiredFields: fiscalProfile.requiredFields,
    complianceNote:
      "Documento operativo interno. Para facturacion electronica fiscal, conectar proveedor autorizado o certificacion local por pais.",
  };
}

async function ensureDefaultAccounts(client, tenantId, currency) {
  for (const [name, accountType] of DEFAULT_ACCOUNTS) {
    await client.query(
      `
        INSERT INTO financial_accounts (tenant_id, name, account_type, currency, status)
        VALUES ($1, $2, $3, $4, 'active')
        ON CONFLICT (tenant_id, account_type, currency) DO NOTHING
      `,
      [tenantId, currency === "USD" ? name : `${name} (${currency})`, accountType, currency],
    );
  }
}

async function accountIdByType(client, tenantId, accountType, currency) {
  await ensureDefaultAccounts(client, tenantId, currency);
  const result = await client.query(
    "SELECT financial_account_id FROM financial_accounts WHERE tenant_id = $1 AND account_type = $2 AND currency = $3 ORDER BY created_at LIMIT 1",
    [tenantId, accountType, currency],
  );
  if (!result.rows[0]) {
    validationError(`Cuenta financiera no encontrada: ${accountType}.`);
  }
  return result.rows[0].financial_account_id;
}

async function postInvoiceLedger(client, context, input) {
  const receivableAccountId = await accountIdByType(client, context.tenant.tenantId, "receivable", input.currency);
  const incomeAccountId = await accountIdByType(client, context.tenant.tenantId, "income", input.currency);
  await insertTransaction(client, context, receivableAccountId, {
    transactionType: "invoice_receivable",
    direction: "debit",
    amount: input.amount,
    currency: input.currency,
    relatedEntityType: "invoice",
    relatedEntityId: input.invoiceId,
    occurredAt: input.occurredAt,
    description: input.description,
  });
  await insertTransaction(client, context, incomeAccountId, {
    transactionType: "income",
    direction: "credit",
    amount: input.amount,
    currency: input.currency,
    relatedEntityType: "invoice",
    relatedEntityId: input.invoiceId,
    occurredAt: input.occurredAt,
    description: input.description,
  });
}

async function postPaymentLedger(client, context, input) {
  const cashAccountId = await accountIdByType(client, context.tenant.tenantId, "cash", input.currency);
  const receivableAccountId = await accountIdByType(client, context.tenant.tenantId, "receivable", input.currency);
  await insertTransaction(client, context, cashAccountId, {
    transactionType: "invoice_payment",
    direction: "debit",
    amount: input.amount,
    currency: input.currency,
    relatedEntityType: "invoice",
    relatedEntityId: input.invoiceId,
    occurredAt: input.occurredAt,
    description: input.description,
  });
  await insertTransaction(client, context, receivableAccountId, {
    transactionType: "receivable_payment",
    direction: "credit",
    amount: input.amount,
    currency: input.currency,
    relatedEntityType: "invoice",
    relatedEntityId: input.invoiceId,
    occurredAt: input.occurredAt,
    description: input.description,
  });
}

async function postCreditNoteLedger(client, context, input) {
  const incomeAccountId = await accountIdByType(client, context.tenant.tenantId, "income", input.currency);
  const receivableAccountId = await accountIdByType(client, context.tenant.tenantId, "receivable", input.currency);
  await insertTransaction(client, context, incomeAccountId, {
    transactionType: "credit_note_income_reversal",
    direction: "debit",
    amount: input.amount,
    currency: input.currency,
    relatedEntityType: "invoice",
    relatedEntityId: input.invoiceId,
    occurredAt: input.occurredAt,
    description: input.description,
  });
  await insertTransaction(client, context, receivableAccountId, {
    transactionType: "credit_note_receivable_reversal",
    direction: "credit",
    amount: input.amount,
    currency: input.currency,
    relatedEntityType: "invoice",
    relatedEntityId: input.invoiceId,
    occurredAt: input.occurredAt,
    description: input.description,
  });
}

async function insertTransaction(client, context, accountId, input) {
  await client.query(
    `
      INSERT INTO financial_transactions (
        tenant_id, financial_account_id, transaction_type, direction, amount, currency,
        related_entity_type, related_entity_id, occurred_at, created_by_user_id, description, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, $10, $11, 'posted')
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
    ],
  );
}

async function writeAudit(client, context, action, entityType, entityId, metadata) {
  await client.query(
    `
      INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, $2, $3, 'invoicing', $4, $5, 'info', $6::jsonb)
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
  return {
    emailDeliveryId: result.rows[0].email_delivery_id,
    recipientEmail: result.rows[0].recipient_email,
    subject: result.rows[0].subject,
    templateKey: result.rows[0].template_key,
    provider: result.rows[0].provider,
    status: result.rows[0].status,
    queuedAt: result.rows[0].queued_at?.toISOString?.() || result.rows[0].queued_at,
    sentAt: result.rows[0].sent_at?.toISOString?.() || result.rows[0].sent_at,
  };
}

function validateInvoiceInput(input) {
  const rawItems = Array.isArray(input.items) ? input.items : [];
  const estimateId = nullableText(input.estimateId, 80);
  const clientId = nullableText(input.clientId, 80);
  const items = rawItems.map(validateInvoiceItem);
  if (!estimateId && !clientId) {
    validationError("Cliente requerido para factura manual.");
  }
  if (!estimateId && items.length < 1) {
    validationError("La factura manual debe tener al menos una partida.");
  }
  return {
    clientId: nullableText(input.clientId, 80),
    jobId: nullableText(input.jobId, 80),
    estimateId,
    invoiceNumber: nullableText(input.invoiceNumber, 60),
    title: nullableText(input.title, 180),
    currency: input.currency ? validateEnum(input.currency, CURRENCIES, "Moneda no soportada.") : null,
    countryProfile: input.countryProfile ? validateEnum(input.countryProfile, COUNTRIES, "Pais/mercado no soportado.") : null,
    documentLanguage: input.documentLanguage ? validateEnum(input.documentLanguage, LANGUAGES, "Idioma documental no soportado.") : null,
    issueDate: nullableDate(input.issueDate) || new Date().toISOString().slice(0, 10),
    dueDate: nullableDate(input.dueDate),
    discountAmount: nonNegativeNumber(input.discountAmount, 0),
    templateId: input.templateId ? validateEnum(input.templateId, new Set(["invoice_clean_red", "invoice_compact_navy"]), "Plantilla de factura no soportada.") : null,
    costBreakdown: normalizeCostBreakdown(input.costBreakdown),
    items,
  };
}

function normalizeCostBreakdown(input = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (typeof value === "object" && value) {
      clean[key] = {
        label: nullableText(value.label, 120) || key,
        applies: value.applies !== false,
        amount: nonNegativeNumber(value.amount, 0),
      };
    }
  }
  return clean;
}

function validateInvoiceItem(item) {
  const quantity = positiveNumber(item.quantity || 1, "Cantidad de partida requerida.");
  const unitPrice = nonNegativeNumber(item.unitPrice, 0);
  return {
    description: requiredText(item.description, 240, "Descripcion de partida requerida."),
    quantity,
    unitCode: nullableText(item.unitCode, 40) || "unit",
    unitPrice,
    taxAmount: nonNegativeNumber(item.taxAmount, 0),
    serviceSnapshot: {},
  };
}

function validatePaymentInput(input) {
  const method = validateEnum(input.method || "cash", PAYMENT_METHODS, "Metodo de pago no soportado.");
  return {
    amount: positiveNumber(input.amount, "Importe de cobro requerido."),
    method,
    receivedAt: nullableIso(input.receivedAt) || new Date().toISOString(),
    reference: nullableText(input.reference, 160),
    notes: nullableText(input.notes, 500),
    idempotencyKey: nullableText(input.idempotencyKey, 160),
  };
}

function validateCreditNoteInput(input) {
  return {
    amount: positiveNumber(input.amount, "Importe de rectificacion requerido."),
    reason: requiredText(input.reason || "Rectificacion de factura", 500, "Motivo de rectificacion requerido."),
    title: nullableText(input.title, 180),
    issueDate: nullableDate(input.issueDate) || new Date().toISOString().slice(0, 10),
  };
}

function mapInvoiceSummary(row) {
  return {
    invoiceId: row.invoice_id,
    clientId: row.client_id,
    clientName: row.client_name || "",
    clientEmail: row.client_email || "",
    jobId: row.job_id || null,
    jobNumber: row.job_number || "",
    jobTitle: row.job_title || "",
    estimateId: row.estimate_id || null,
    estimateNumber: row.estimate_number || "",
    invoiceNumber: row.invoice_number,
    invoiceType: row.invoice_type || "standard",
    title: row.title || row.invoice_number,
    status: row.status,
    subtotalAmount: Number(row.subtotal_amount || 0),
    taxAmount: Number(row.tax_amount || 0),
    discountAmount: Number(row.discount_amount || 0),
    totalAmount: Number(row.total_amount || 0),
    balanceAmount: Number(row.balance_amount || 0),
    currency: row.currency || "USD",
    issueDate: row.issue_date?.toISOString?.().slice(0, 10) || row.issue_date || "",
    dueDate: row.due_date?.toISOString?.().slice(0, 10) || row.due_date || "",
    countryProfile: row.country_profile || "US",
    documentLanguage: row.document_language || "es",
    billingSnapshot: row.billing_snapshot || {},
    costBreakdown: row.cost_breakdown || {},
    companySnapshot: row.company_snapshot || {},
    templateId: row.template_id || "invoice_clean_red",
    correctsInvoiceId: row.corrects_invoice_id || null,
    correctsInvoiceNumber: row.corrects_invoice_number || "",
    correctionReason: row.correction_reason || "",
    pdfDocumentId: row.pdf_document_id || null,
    sentAt: row.sent_at?.toISOString?.() || row.sent_at || "",
    paidAt: row.paid_at?.toISOString?.() || row.paid_at || "",
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
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

function mapInvoiceItem(row) {
  return {
    invoiceItemId: row.invoice_item_id,
    description: row.description,
    quantity: Number(row.quantity || 0),
    unitCode: row.unit_code || "unit",
    unitPrice: Number(row.unit_price || 0),
    taxAmount: Number(row.tax_amount || 0),
    totalAmount: Number(row.total_amount || 0),
    serviceSnapshot: row.service_snapshot || {},
  };
}

function mapPayment(row) {
  return {
    paymentId: row.payment_id,
    amount: Number(row.amount || 0),
    currency: row.currency || "USD",
    method: row.method,
    status: row.status,
    receivedAt: row.received_at?.toISOString?.() || row.received_at,
    reference: row.reference || "",
    notes: row.notes || "",
    receiptNumber: row.receipt_number || "",
    documentId: row.document_id || null,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  };
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

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    validationError("La factura necesita un correo de cliente valido para preparar el envio.");
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
