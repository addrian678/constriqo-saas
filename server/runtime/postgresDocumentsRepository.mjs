import { createPostgresPoolFromEnv } from "./postgresAuthRepository.mjs";
import { decryptSecret, verifyPassword, verifyTotpCode } from "./cryptoAuth.mjs";
import { randomUUID } from "node:crypto";

const DOCUMENT_STATUSES = new Set(["active", "pending_review", "expired", "archived", "generated"]);
const HEAVY_DOCUMENT_TYPES = [
  "invoice_pdf",
  "estimate_pdf",
  "receipt_pdf",
  "image",
  "photo",
  "proof_photo",
  "job_photo",
  "work_photo",
  "evidence_photo",
  "field_report_photo",
  "general_image",
];
const CLEANUP_ESCALATION_DAYS = 20;

export function createPostgresDocumentsRepositoryFromEnv(env = process.env) {
  const pool = createPostgresPoolFromEnv(env);
  if (!pool) {
    return null;
  }

  return {
    ...createPostgresDocumentsRepository(pool),
    async close() {
      await pool.end();
    },
  };
}

export function createPostgresDocumentsRepository(pool) {
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

  async function listDocuments(context) {
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          SELECT document_id, title, document_type, status, storage_key, related_entity_type,
                 related_entity_id, expires_at, heavy_file_cleaned_at, heavy_file_cleanup_batch_id,
                 heavy_file_cleanup_cutoff_at, storage_size_bytes, storage_provider, storage_uploaded_at,
                 storage_checksum_sha256, storage_persisted, storage_persist_error, created_at, updated_at
          FROM documents
          WHERE tenant_id = $1
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 200
        `,
        [context.tenant.tenantId],
      );
      const summary = await summarizeDocuments(client, context.tenant.tenantId);
      return { items: result.rows.map(mapDocument), total: result.rowCount, summary };
    });
  }

  async function getArchivePlan(context) {
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          SELECT document_id, title, document_type, status, storage_key, related_entity_type,
                 related_entity_id, expires_at, heavy_file_cleaned_at, heavy_file_cleanup_batch_id,
                 heavy_file_cleanup_cutoff_at, storage_size_bytes, storage_provider, storage_uploaded_at,
                 storage_checksum_sha256, storage_persisted, storage_persist_error, created_at, updated_at
          FROM documents
          WHERE tenant_id = $1
            AND storage_key IS NOT NULL
            AND status <> 'archived'
            AND created_at <= now() - interval '6 months'
          ORDER BY created_at ASC
          LIMIT 250
        `,
        [context.tenant.tenantId],
      );
      const summary = await summarizeDocuments(client, context.tenant.tenantId);
      return { items: result.rows.map(mapDocument), total: result.rowCount, summary };
    });
  }

  async function getCleanupStatus(context) {
    return queryForTenant(context, async (client) => getCleanupStatusForClient(client, context));
  }

  async function createDocument(context, input = {}) {
    const clean = validateDocumentInput(input);
    return queryForTenant(context, async (client) => {
      await enforceDocumentQuota(client, context, clean);
      const result = await client.query(
        `
          INSERT INTO documents (
            tenant_id, title, document_type, status, storage_key,
            related_entity_type, related_entity_id, expires_at, storage_size_bytes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9)
          RETURNING document_id, title, document_type, status, storage_key, related_entity_type,
                    related_entity_id, expires_at, heavy_file_cleaned_at, heavy_file_cleanup_batch_id,
                    heavy_file_cleanup_cutoff_at, storage_size_bytes, storage_provider, storage_uploaded_at,
                    storage_checksum_sha256, storage_persisted, storage_persist_error, created_at, updated_at
        `,
        [
          context.tenant.tenantId,
          clean.title,
          clean.documentType,
          clean.status,
          clean.storageKey,
          clean.relatedEntityType,
          clean.relatedEntityId,
          clean.expiresAt,
          clean.storageSizeBytes,
        ],
      );
      await writeAudit(client, context, "documents.created", "document", result.rows[0].document_id, {
        documentType: clean.documentType,
        relatedEntityType: clean.relatedEntityType,
      });
      return mapDocument(result.rows[0]);
    });
  }

  async function markArchiveCompleted(context, input = {}) {
    const documentIds = Array.isArray(input.documentIds) ? input.documentIds.map((value) => String(value || "").trim()).filter(Boolean) : [];
    if (documentIds.length === 0 || documentIds.length > 250) {
      validationError("Selecciona entre 1 y 250 documentos para confirmar archivo.");
    }
    const batchId = randomUUID();
    const note = nullableText(input.note, 500);
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          UPDATE documents
          SET status = 'archived',
              archived_at = now(),
              archived_by_user_id = $3,
              archive_batch_id = $4,
              archive_note = $5,
              updated_at = now()
          WHERE tenant_id = $1
            AND document_id = ANY($2::uuid[])
            AND storage_key IS NOT NULL
          RETURNING document_id, title, document_type, status, storage_key, related_entity_type,
                    related_entity_id, expires_at, heavy_file_cleaned_at, heavy_file_cleanup_batch_id,
                    heavy_file_cleanup_cutoff_at, storage_size_bytes, storage_provider, storage_uploaded_at,
                    storage_checksum_sha256, storage_persisted, storage_persist_error, created_at, updated_at
        `,
        [context.tenant.tenantId, documentIds, context.actor.userId, batchId, note],
      );
      if (result.rowCount !== documentIds.length) {
        validationError("Algunos documentos no pertenecen a esta empresa o no tienen archivo asociado.");
      }
      await writeAudit(client, context, "documents.archive.completed", "document_archive_batch", batchId, {
        count: result.rowCount,
        note: note || "",
      });
      await client.query(
        `
          INSERT INTO notification_queue (tenant_id, audience_role, channel, event_key, title, message, severity, related_entity_type, related_entity_id)
          VALUES ($1, 'admin', 'in_app', 'documents.archive_completed', 'Archivo semestral confirmado', $2, 'success', 'document_archive_batch', $3)
        `,
        [context.tenant.tenantId, `${result.rowCount} documento(s) marcados como archivados.`, batchId],
      );
      const summary = await summarizeDocuments(client, context.tenant.tenantId);
      return { batchId, items: result.rows.map(mapDocument), updated: result.rowCount, summary };
    });
  }

  async function cleanupHeavyFiles(context, input = {}) {
    const clean = validateCleanupInput(input);
    const batchId = randomUUID();

    return queryForTenant(context, async (client) => {
      await verifyCleanupAuthorization(client, context, clean);
      const status = await getCleanupStatusForClient(client, context);
      if (status.eligibleCount === 0) {
        validationError(
          status.requiresArchiveCount > 0
            ? "Primero descarga y confirma el archivo de los documentos pendientes antes de limpiar archivos pesados."
            : "No hay archivos pesados archivados pendientes de limpieza segura.",
        );
      }

      const result = await client.query(
        `
          WITH eligible AS (
            SELECT document_id
            FROM documents
            WHERE tenant_id = $1
              AND storage_key IS NOT NULL
              AND heavy_file_cleaned_at IS NULL
              AND status = 'archived'
              AND document_type = ANY($2::text[])
              AND created_at <= $3::timestamptz
            ORDER BY created_at ASC
            LIMIT 250
            FOR UPDATE
          )
          UPDATE documents d
          SET heavy_file_original_storage_key = COALESCE(d.heavy_file_original_storage_key, d.storage_key),
              storage_key = NULL,
              heavy_file_cleaned_at = now(),
              heavy_file_cleaned_by_user_id = $4,
              heavy_file_cleanup_batch_id = $5,
              heavy_file_cleanup_cutoff_at = $3::timestamptz,
              heavy_file_cleanup_note = $6,
              updated_at = now()
          FROM eligible
          WHERE d.document_id = eligible.document_id
            AND d.tenant_id = $1
          RETURNING d.document_id, d.title, d.document_type, d.status, d.storage_key, d.related_entity_type,
                    d.related_entity_id, d.expires_at, d.heavy_file_cleaned_at, d.heavy_file_cleanup_batch_id,
                    d.heavy_file_cleanup_cutoff_at, d.storage_size_bytes, d.storage_provider, d.storage_uploaded_at,
                    d.storage_checksum_sha256, d.storage_persisted, d.storage_persist_error, d.created_at, d.updated_at
        `,
        [context.tenant.tenantId, HEAVY_DOCUMENT_TYPES, status.cleanupCutoffAt, context.actor.userId, batchId, clean.note],
      );

      await writeAudit(client, context, "documents.heavy_file_cleanup.completed", "document_cleanup_batch", batchId, {
        count: result.rowCount,
        cutoffAt: status.cleanupCutoffAt,
        confirmedExternalArchive: true,
        note: clean.note || "",
      });
      await client.query(
        `
          INSERT INTO notification_queue (tenant_id, audience_role, channel, event_key, title, message, severity, related_entity_type, related_entity_id)
          VALUES ($1, 'admin', 'in_app', 'documents.cleanup_completed', 'Limpieza segura completada', $2, 'success', 'document_cleanup_batch', $3)
        `,
        [
          context.tenant.tenantId,
          `${result.rowCount} archivo(s) pesado(s) archivados fueron limpiados. La metadata y auditoria permanecen en la base de datos.`,
          batchId,
        ],
      );
      const summary = await summarizeDocuments(client, context.tenant.tenantId);
      const nextStatus = await getCleanupStatusForClient(client, context);
      return {
        batchId,
        cutoffAt: status.cleanupCutoffAt,
        items: result.rows.map(mapDocument),
        updated: result.rowCount,
        summary,
        cleanupStatus: nextStatus,
      };
    });
  }

  return { listDocuments, getArchivePlan, getCleanupStatus, createDocument, markArchiveCompleted, cleanupHeavyFiles };
}

async function getCleanupStatusForClient(client, context) {
  const schedule = await client.query(
    `
      WITH first_use AS (
        SELECT COALESCE(
          (SELECT min(created_at) FROM auth_sessions WHERE tenant_id = $1),
          (SELECT min(created_at) FROM users WHERE tenant_id = $1),
          (SELECT created_at FROM tenants WHERE tenant_id = $1),
          now()
        ) AS first_use_at
      ),
      last_cleanup AS (
        SELECT max(heavy_file_cleanup_cutoff_at) AS last_cutoff_at
        FROM documents
        WHERE tenant_id = $1
          AND heavy_file_cleaned_at IS NOT NULL
      )
      SELECT
        first_use.first_use_at,
        last_cleanup.last_cutoff_at,
        CASE
          WHEN last_cleanup.last_cutoff_at IS NULL THEN first_use.first_use_at + interval '5 months'
          ELSE last_cleanup.last_cutoff_at + interval '6 months'
        END AS cleanup_cutoff_at,
        now() AS checked_at
      FROM first_use, last_cleanup
    `,
    [context.tenant.tenantId],
  );
  const row = schedule.rows[0];
  const cleanupCutoffAt = row.cleanup_cutoff_at;
  const eligible = await client.query(
    `
      SELECT document_id, title, document_type, status, storage_key, related_entity_type,
             related_entity_id, expires_at, heavy_file_cleaned_at, heavy_file_cleanup_batch_id,
             heavy_file_cleanup_cutoff_at, storage_size_bytes, storage_provider, storage_uploaded_at,
             storage_checksum_sha256, storage_persisted, storage_persist_error, created_at, updated_at
      FROM documents
      WHERE tenant_id = $1
        AND storage_key IS NOT NULL
        AND heavy_file_cleaned_at IS NULL
        AND status = 'archived'
        AND document_type = ANY($2::text[])
        AND created_at <= $3::timestamptz
      ORDER BY created_at ASC
      LIMIT 250
    `,
    [context.tenant.tenantId, HEAVY_DOCUMENT_TYPES, cleanupCutoffAt],
  );
  const requiresArchive = await client.query(
    `
      SELECT count(*)::integer AS total
      FROM documents
      WHERE tenant_id = $1
        AND storage_key IS NOT NULL
        AND heavy_file_cleaned_at IS NULL
        AND status <> 'archived'
        AND document_type = ANY($2::text[])
        AND created_at <= $3::timestamptz
    `,
    [context.tenant.tenantId, HEAVY_DOCUMENT_TYPES, cleanupCutoffAt],
  );
  const now = new Date(row.checked_at);
  const cutoff = new Date(cleanupCutoffAt);
  const eligibleCount = eligible.rowCount;
  const requiresArchiveCount = Number(requiresArchive.rows[0]?.total || 0);
  const isDue = now >= cutoff && (eligibleCount > 0 || requiresArchiveCount > 0);
  const daysOverdue = isDue ? Math.max(0, Math.floor((now.getTime() - cutoff.getTime()) / 86_400_000)) : 0;
  const severity = !isDue ? "none" : daysOverdue >= CLEANUP_ESCALATION_DAYS ? "danger" : "warning";

  return {
    firstUseAt: row.first_use_at?.toISOString?.() || row.first_use_at,
    lastCleanupCutoffAt: row.last_cutoff_at?.toISOString?.() || row.last_cutoff_at || null,
    cleanupCutoffAt: cleanupCutoffAt?.toISOString?.() || cleanupCutoffAt,
    checkedAt: row.checked_at?.toISOString?.() || row.checked_at,
    severity,
    daysOverdue,
    escalationDays: CLEANUP_ESCALATION_DAYS,
    eligibleCount,
    requiresArchiveCount,
    items: eligible.rows.map(mapDocument),
    recommendation:
      "Descarga y guarda el archivo en una PC o memoria externa antes de limpiar. Si lo dejas solo en el telefono, puedes perderlo si el dispositivo se extravia. Despues de limpiar, la metadata queda en la base de datos, pero el PDF o imagen fisica no se puede recuperar desde la app.",
  };
}

async function verifyCleanupAuthorization(client, context, input) {
  const normalizedEmail = normalizeEmail(input.email);
  const credential = await client.query(
    `
      SELECT u.user_id, u.email, pc.password_hash
      FROM users u
      JOIN auth_password_credentials pc ON pc.tenant_id = u.tenant_id AND pc.user_id = u.user_id
      WHERE u.tenant_id = $1
        AND u.user_id = $2
        AND lower(u.email) = lower($3)
        AND u.status = 'active'
      LIMIT 1
    `,
    [context.tenant.tenantId, context.actor.userId, normalizedEmail],
  );
  if (!credential.rows[0] || !(await verifyPassword(input.password, credential.rows[0].password_hash))) {
    authError("Credenciales invalidas para limpieza segura.");
  }

  const factor = await client.query(
    `
      SELECT factor_id, secret_ciphertext, secret_iv, secret_tag
      FROM auth_mfa_factors
      WHERE tenant_id = $1
        AND user_id = $2
        AND factor_type = 'totp'
        AND status = 'enabled'
      ORDER BY verified_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `,
    [context.tenant.tenantId, context.actor.userId],
  );
  if (!factor.rows[0]) {
    const error = new Error("Debes tener autenticacion de dos factores activa para limpiar archivos pesados.");
    error.status = 403;
    error.code = "MFA_REQUIRED";
    throw error;
  }

  const secret = decryptSecret({
    ciphertext: factor.rows[0].secret_ciphertext,
    iv: factor.rows[0].secret_iv,
    tag: factor.rows[0].secret_tag,
  });
  if (!verifyTotpCode({ secret, code: input.totpCode })) {
    authError("Codigo de autenticacion de dos factores invalido.");
  }

  await client.query(
    `
      UPDATE auth_mfa_factors
      SET last_used_at = now(), updated_at = now()
      WHERE factor_id = $1
        AND tenant_id = $2
        AND user_id = $3
    `,
    [factor.rows[0].factor_id, context.tenant.tenantId, context.actor.userId],
  );
}

async function summarizeDocuments(client, tenantId) {
  const result = await client.query(
    `
      SELECT
        count(*)::integer AS total,
        count(*) FILTER (WHERE status = 'active')::integer AS active,
        count(*) FILTER (WHERE status = 'generated')::integer AS generated,
        count(*) FILTER (WHERE status = 'archived')::integer AS archived,
        count(*) FILTER (WHERE storage_key IS NOT NULL AND status <> 'archived')::integer AS storage_refs,
        count(*) FILTER (
          WHERE storage_key IS NOT NULL
            AND status <> 'archived'
            AND created_at <= now() - interval '6 months'
        )::integer AS archive_due,
        count(*) FILTER (
          WHERE storage_key IS NOT NULL
            AND heavy_file_cleaned_at IS NULL
            AND status = 'archived'
            AND document_type = ANY($2::text[])
        )::integer AS cleanup_candidates,
        count(*) FILTER (WHERE status = 'pending_review')::integer AS pending_review,
        count(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at <= CURRENT_DATE + interval '30 days' AND status <> 'archived')::integer AS expiring
      FROM documents
      WHERE tenant_id = $1
    `,
    [tenantId, HEAVY_DOCUMENT_TYPES],
  );
  return {
    total: Number(result.rows[0]?.total || 0),
    active: Number(result.rows[0]?.active || 0),
    generated: Number(result.rows[0]?.generated || 0),
    archived: Number(result.rows[0]?.archived || 0),
    storageRefs: Number(result.rows[0]?.storage_refs || 0),
    archiveDue: Number(result.rows[0]?.archive_due || 0),
    cleanupCandidates: Number(result.rows[0]?.cleanup_candidates || 0),
    pendingReview: Number(result.rows[0]?.pending_review || 0),
    expiring: Number(result.rows[0]?.expiring || 0),
  };
}

async function enforceDocumentQuota(client, context, clean) {
  const limits = await client.query(
    `
      INSERT INTO tenant_usage_limits (tenant_id, updated_by_user_id)
      VALUES ($1, $2)
      ON CONFLICT (tenant_id) DO UPDATE
      SET updated_at = tenant_usage_limits.updated_at
      RETURNING storage_quota_mb, document_quota
    `,
    [context.tenant.tenantId, context.actor.userId],
  );
  const usage = await client.query(
    `
      SELECT
        COALESCE((SELECT sum(size_bytes) FROM storage_objects WHERE tenant_id = $1 AND status NOT IN ('deleted', 'revoked')), 0)::bigint
          + COALESCE((SELECT sum(storage_size_bytes) FROM documents WHERE tenant_id = $1 AND storage_key IS NOT NULL AND heavy_file_cleaned_at IS NULL), 0)::bigint AS storage_used_bytes,
        (SELECT count(*)::integer FROM documents WHERE tenant_id = $1)::integer AS document_count
    `,
    [context.tenant.tenantId],
  );
  const storageQuotaBytes = Number(limits.rows[0].storage_quota_mb || 1024) * 1024 * 1024;
  const documentQuota = Number(limits.rows[0].document_quota || 5000);
  const nextStorageBytes = Number(usage.rows[0].storage_used_bytes || 0) + Number(clean.storageSizeBytes || 0);
  const nextDocumentCount = Number(usage.rows[0].document_count || 0) + 1;

  if (nextDocumentCount > documentQuota) {
    quotaError("La empresa alcanzo su limite de documentos. Amplia la cuota o revisa el plan antes de crear nuevas fichas.");
  }
  if (clean.storageKey && nextStorageBytes > storageQuotaBytes) {
    quotaError("La empresa alcanzo su limite de almacenamiento. Archiva y limpia archivos pesados antes de crear nuevos documentos.");
  }
}

async function writeAudit(client, context, action, entityType, entityId, metadata) {
  await client.query(
    `
      INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, $2, $3, 'documents', $4, $5, 'info', $6::jsonb)
    `,
    [context.tenant.tenantId, context.actor.userId, action, entityType, entityId, JSON.stringify(metadata || {})],
  );
}

function validateDocumentInput(input) {
  return {
    title: requiredText(input.title, 180, "Titulo de documento requerido."),
    documentType: requiredText(input.documentType || input.document_type || "general", 80, "Tipo de documento requerido."),
    status: validateEnum(input.status || "active", DOCUMENT_STATUSES, "Estado de documento no soportado."),
    storageKey: nullableText(input.storageKey || input.storage_key, 500),
    relatedEntityType: nullableText(input.relatedEntityType || input.related_entity_type, 80),
    relatedEntityId: nullableText(input.relatedEntityId || input.related_entity_id, 80),
    expiresAt: nullableDate(input.expiresAt || input.expires_at),
    storageSizeBytes: nonNegativeInteger(input.storageSizeBytes ?? input.storage_size_bytes, 0, 10_737_418_240, "Tamano de archivo no valido."),
  };
}

function mapDocument(row) {
  return {
    documentId: row.document_id,
    title: row.title,
    documentType: row.document_type,
    status: row.status,
    storageKey: row.storage_key || "",
    relatedEntityType: row.related_entity_type || "",
    relatedEntityId: row.related_entity_id || null,
    expiresAt: row.expires_at?.toISOString?.().slice(0, 10) || row.expires_at || "",
    heavyFileCleanedAt: row.heavy_file_cleaned_at?.toISOString?.() || row.heavy_file_cleaned_at || null,
    heavyFileCleanupBatchId: row.heavy_file_cleanup_batch_id || null,
    heavyFileCleanupCutoffAt: row.heavy_file_cleanup_cutoff_at?.toISOString?.() || row.heavy_file_cleanup_cutoff_at || null,
    storageSizeBytes: Number(row.storage_size_bytes || 0),
    storageProvider: row.storage_provider || "",
    storageUploadedAt: row.storage_uploaded_at?.toISOString?.() || row.storage_uploaded_at || null,
    storageChecksumSha256: row.storage_checksum_sha256 || "",
    storagePersisted: Boolean(row.storage_persisted),
    storagePersistError: row.storage_persist_error || "",
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function validateCleanupInput(input) {
  const email = requiredText(input.email, 180, "Correo requerido para confirmar limpieza.");
  const password = requiredText(input.password, 300, "Contrasena requerida para confirmar limpieza.");
  const totpCode = requiredText(input.totpCode || input.totp_code, 12, "Codigo de dos factores requerido.");
  if (!input.confirmExternalArchive) {
    validationError("Confirma que descargaste y archivaste los archivos en una PC o memoria externa antes de limpiar.");
  }
  return {
    email,
    password,
    totpCode,
    note: nullableText(input.note, 500),
  };
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
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

function nonNegativeInteger(value, fallback, max, message) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > max) {
    validationError(message);
  }
  return number;
}

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = "VALIDATION_ERROR";
  throw error;
}

function quotaError(message) {
  const error = new Error(message);
  error.status = 402;
  error.code = "TENANT_STORAGE_LIMIT_REACHED";
  throw error;
}

function authError(message) {
  const error = new Error(message);
  error.status = 401;
  error.code = "AUTHORIZATION_FAILED";
  throw error;
}
