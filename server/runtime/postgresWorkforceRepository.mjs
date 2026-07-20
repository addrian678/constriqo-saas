import { createPostgresPoolFromEnv } from "./postgresAuthRepository.mjs";
import { createEmailMetadata, resolveEmailDeliveryConfig } from "./emailDeliveryRuntime.mjs";
import { randomBytes } from "node:crypto";
import argon2 from "argon2";

const WORKER_STATUSES = new Set(["active", "inactive", "suspended"]);
const AVAILABILITY_STATUSES = new Set(["available", "assigned", "time_off", "unavailable"]);
const CERTIFICATION_STATUSES = new Set(["valid", "expiring", "expired", "pending_review"]);
const LANGUAGES = new Set(["es", "en", "es-US", "en-US", "es-CO", "es-ES"]);

export function createPostgresWorkforceRepositoryFromEnv(env = process.env) {
  const pool = createPostgresPoolFromEnv(env);
  if (!pool) {
    return null;
  }

  return {
    ...createPostgresWorkforceRepository(pool),
    async close() {
      await pool.end();
    },
  };
}

export function createPostgresWorkforceRepository(pool) {
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
      const params = [context.tenant.tenantId];
      const where = ["w.tenant_id = $1"];
      if (filters.status && WORKER_STATUSES.has(filters.status)) {
        params.push(filters.status);
        where.push(`w.status = $${params.length}`);
      } else {
        where.push("w.status <> 'inactive'");
      }
      if (filters.search) {
        params.push(`%${String(filters.search).trim().toLowerCase()}%`);
        where.push(`(lower(w.name) LIKE $${params.length} OR lower(COALESCE(w.trade, '')) LIKE $${params.length})`);
      }

      const result = await client.query(
        `
          SELECT w.worker_id, w.user_id, u.email AS user_email, w.name, w.status, w.trade,
                 p.emergency_contact_name, p.emergency_contact_phone, p.preferred_language, p.notes,
                 w.created_at, w.updated_at,
                 count(DISTINCT a.assignment_id)::integer AS active_assignments,
                 count(DISTINCT c.certification_id) FILTER (WHERE c.status IN ('pending_review', 'expired', 'expiring'))::integer AS document_alerts
          FROM workers w
          LEFT JOIN users u ON u.tenant_id = w.tenant_id AND u.user_id = w.user_id
          LEFT JOIN worker_profiles p ON p.tenant_id = w.tenant_id AND p.worker_id = w.worker_id
          LEFT JOIN assignments a ON a.tenant_id = w.tenant_id AND a.worker_id = w.worker_id AND a.status <> 'closed'
          LEFT JOIN worker_certifications c ON c.tenant_id = w.tenant_id AND c.worker_id = w.worker_id
          WHERE ${where.join(" AND ")}
          GROUP BY w.worker_id, u.email, p.worker_profile_id
          ORDER BY w.updated_at DESC, w.created_at DESC
          LIMIT 150
        `,
        params,
      );
      const summary = await client.query(
        `
          SELECT
            count(*) FILTER (WHERE status <> 'inactive')::integer AS total,
            count(*) FILTER (WHERE status = 'active')::integer AS active,
            count(*) FILTER (WHERE status = 'suspended')::integer AS suspended
          FROM workers
          WHERE tenant_id = $1
        `,
        [context.tenant.tenantId],
      );

      return {
        items: result.rows.map(mapWorker),
        total: result.rowCount,
        summary: {
          ...summary.rows[0],
          documentAlerts: result.rows.reduce((total, row) => total + Number(row.document_alerts || 0), 0),
        },
      };
    });
  }

  async function getWorker(context, workerId) {
    return queryForTenant(context, async (client) => {
      const worker = await client.query(
        `
          SELECT w.worker_id, w.user_id, u.email AS user_email, w.name, w.status, w.trade,
                 p.emergency_contact_name, p.emergency_contact_phone, p.preferred_language, p.notes,
                 w.created_at, w.updated_at,
                 count(DISTINCT a.assignment_id)::integer AS active_assignments,
                 count(DISTINCT c.certification_id) FILTER (WHERE c.status IN ('pending_review', 'expired', 'expiring'))::integer AS document_alerts
          FROM workers w
          LEFT JOIN users u ON u.tenant_id = w.tenant_id AND u.user_id = w.user_id
          LEFT JOIN worker_profiles p ON p.tenant_id = w.tenant_id AND p.worker_id = w.worker_id
          LEFT JOIN assignments a ON a.tenant_id = w.tenant_id AND a.worker_id = w.worker_id AND a.status <> 'closed'
          LEFT JOIN worker_certifications c ON c.tenant_id = w.tenant_id AND c.worker_id = w.worker_id
          WHERE w.tenant_id = $1 AND w.worker_id = $2
          GROUP BY w.worker_id, u.email, p.worker_profile_id
        `,
        [context.tenant.tenantId, workerId],
      );
      if (!worker.rows[0]) {
        return null;
      }

      const availability = await client.query(
        `
          SELECT availability_id, availability_date, status, notes, created_at
          FROM worker_availability
          WHERE tenant_id = $1 AND worker_id = $2
          ORDER BY availability_date DESC
          LIMIT 30
        `,
        [context.tenant.tenantId, workerId],
      );
      const certifications = await client.query(
        `
          SELECT certification_id, name, status, document_id, expires_at, created_at, updated_at
          FROM worker_certifications
          WHERE tenant_id = $1 AND worker_id = $2
          ORDER BY expires_at NULLS LAST, created_at DESC
          LIMIT 50
        `,
        [context.tenant.tenantId, workerId],
      );

      return {
        worker: mapWorker(worker.rows[0]),
        availability: availability.rows.map(mapAvailability),
        certifications: certifications.rows.map(mapCertification),
      };
    });
  }

  async function createWorker(context, input) {
    const clean = validateWorkerInput(input);
    return queryForTenant(context, async (client) => {
      if (clean.userId) {
        await requireUserForTenant(client, context.tenant.tenantId, clean.userId);
      }
      const result = await client.query(
        `
          INSERT INTO workers (tenant_id, user_id, name, status, trade)
          VALUES ($1, $2, $3, 'active', $4)
          RETURNING worker_id, user_id, name, status, trade, created_at, updated_at
        `,
        [context.tenant.tenantId, clean.userId, clean.name, clean.trade],
      );
      await upsertProfile(client, context.tenant.tenantId, result.rows[0].worker_id, clean);
      await writeAudit(client, context, "workforce.worker.created", "worker", result.rows[0].worker_id, {
        trade: clean.trade,
        linkedUser: Boolean(clean.userId),
      });
      return mapWorker({ ...result.rows[0], ...profileRowFromClean(clean), active_assignments: 0, document_alerts: 0 });
    });
  }

  async function createWorkerUser(context, input) {
    const clean = validateWorkerUserInput(input);
    const temporaryPassword = clean.password || generateTemporaryPassword();
    const passwordHash = await argon2.hash(temporaryPassword, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    return queryForTenant(context, async (client) => {
      const workerRole = await client.query("SELECT role_id FROM roles WHERE tenant_id = $1 AND code = 'worker'", [context.tenant.tenantId]);
      if (!workerRole.rows[0]) {
        validationError("El rol trabajador no existe para esta empresa.");
      }

      let worker = null;
      if (clean.workerId) {
        worker = await requireWorkerForTenant(client, context.tenant.tenantId, clean.workerId);
        const linkedUser = await client.query("SELECT user_id FROM workers WHERE tenant_id = $1 AND worker_id = $2 AND user_id IS NOT NULL", [context.tenant.tenantId, clean.workerId]);
        if (linkedUser.rows[0]) {
          validationError("Este trabajador ya tiene un usuario enlazado.");
        }
      }

      const userResult = await client.query(
        `
          INSERT INTO users (tenant_id, email, display_name, status)
          VALUES ($1, $2, $3, 'active')
          ON CONFLICT (tenant_id, email) DO UPDATE
          SET display_name = EXCLUDED.display_name,
              status = 'active',
              updated_at = now()
          RETURNING user_id, tenant_id, email, display_name, status, created_at, updated_at
        `,
        [context.tenant.tenantId, clean.email, clean.name],
      );
      const user = userResult.rows[0];

      await client.query(
        `
          INSERT INTO user_roles (tenant_id, user_id, role_id)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, role_id) DO NOTHING
        `,
        [context.tenant.tenantId, user.user_id, workerRole.rows[0].role_id],
      );

      await client.query(
        `
          INSERT INTO auth_password_credentials (tenant_id, user_id, password_hash, password_algorithm)
          VALUES ($1, $2, $3, 'argon2id')
          ON CONFLICT (tenant_id, user_id) DO UPDATE
          SET password_hash = EXCLUDED.password_hash,
              password_algorithm = 'argon2id',
              password_updated_at = now()
        `,
        [context.tenant.tenantId, user.user_id, passwordHash],
      );

      let workerResult;
      if (worker) {
        workerResult = await client.query(
          `
            UPDATE workers
            SET user_id = $3,
                name = COALESCE($4, name),
                status = 'active',
                trade = COALESCE($5, trade),
                updated_at = now()
            WHERE tenant_id = $1 AND worker_id = $2
            RETURNING worker_id, user_id, name, status, trade, created_at, updated_at
          `,
          [context.tenant.tenantId, clean.workerId, user.user_id, clean.name, clean.trade],
        );
      } else {
        workerResult = await client.query(
          `
            INSERT INTO workers (tenant_id, user_id, name, status, trade)
            VALUES ($1, $2, $3, 'active', $4)
            RETURNING worker_id, user_id, name, status, trade, created_at, updated_at
          `,
          [context.tenant.tenantId, user.user_id, clean.name, clean.trade],
        );
      }

      await upsertProfile(client, context.tenant.tenantId, workerResult.rows[0].worker_id, clean);
      await writeAudit(client, context, "workforce.worker_user.created", "worker", workerResult.rows[0].worker_id, {
        userId: user.user_id,
        email: user.email,
        linkedExistingWorker: Boolean(clean.workerId),
        passwordStored: "argon2id-hash-only",
      });
      const emailDelivery = await queueWorkerAccessEmail(client, context, user);

      return {
        user: {
          userId: user.user_id,
          email: user.email,
          displayName: user.display_name,
          status: user.status,
          role: "worker",
        },
        worker: mapWorker({
          ...workerResult.rows[0],
          user_email: user.email,
          ...profileRowFromClean(clean),
          active_assignments: 0,
          document_alerts: 0,
        }),
        temporaryPassword,
        emailDelivery,
      };
    });
  }

  async function updateWorker(context, workerId, input) {
    const clean = validateWorkerInput(input, { partial: true });
    return queryForTenant(context, async (client) => {
      await requireWorkerForTenant(client, context.tenant.tenantId, workerId);
      if (clean.userId) {
        await requireUserForTenant(client, context.tenant.tenantId, clean.userId);
      }
      const result = await client.query(
        `
          UPDATE workers
          SET user_id = COALESCE($3, user_id),
              name = COALESCE($4, name),
              status = COALESCE($5, status),
              trade = COALESCE($6, trade),
              updated_at = now()
          WHERE tenant_id = $1 AND worker_id = $2
          RETURNING worker_id, user_id, name, status, trade, created_at, updated_at
        `,
        [context.tenant.tenantId, workerId, clean.userId, clean.name, clean.status, clean.trade],
      );
      await upsertProfile(client, context.tenant.tenantId, workerId, clean);
      await writeAudit(client, context, "workforce.worker.updated", "worker", workerId, {
        fields: Object.keys(clean).filter((key) => clean[key] !== undefined),
      });
      return mapWorker({ ...result.rows[0], ...profileRowFromClean(clean), active_assignments: 0, document_alerts: 0 });
    });
  }

  return {
    listWorkers,
    getWorker,
    createWorker,
    createWorkerUser,
    updateWorker,
  };
}

async function upsertProfile(client, tenantId, workerId, clean) {
  const hasProfileField = ["emergencyContactName", "emergencyContactPhone", "preferredLanguage", "notes"].some(
    (key) => clean[key] !== undefined,
  );
  if (!hasProfileField) {
    return;
  }
  await client.query(
    `
      INSERT INTO worker_profiles (
        tenant_id, worker_id, emergency_contact_name, emergency_contact_phone, preferred_language, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (tenant_id, worker_id) DO UPDATE
      SET emergency_contact_name = COALESCE(EXCLUDED.emergency_contact_name, worker_profiles.emergency_contact_name),
          emergency_contact_phone = COALESCE(EXCLUDED.emergency_contact_phone, worker_profiles.emergency_contact_phone),
          preferred_language = COALESCE(EXCLUDED.preferred_language, worker_profiles.preferred_language),
          notes = COALESCE(EXCLUDED.notes, worker_profiles.notes),
          updated_at = now()
    `,
    [
      tenantId,
      workerId,
      clean.emergencyContactName,
      clean.emergencyContactPhone,
      clean.preferredLanguage,
      clean.notes,
    ],
  );
}

async function requireUserForTenant(client, tenantId, userId) {
  const result = await client.query("SELECT user_id FROM users WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'", [tenantId, userId]);
  if (!result.rows[0]) {
    notFound("Usuario no encontrado para esta empresa.");
  }
}

async function requireWorkerForTenant(client, tenantId, workerId) {
  const result = await client.query("SELECT worker_id, user_id, name, status, trade FROM workers WHERE tenant_id = $1 AND worker_id = $2", [tenantId, workerId]);
  if (!result.rows[0]) {
    notFound("Trabajador no encontrado para esta empresa.");
  }
  return result.rows[0];
}

async function writeAudit(client, context, action, entityType, entityId, metadata) {
  await client.query(
    `
      INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, $2, $3, 'workforce', $4, $5, 'info', $6::jsonb)
    `,
    [context.tenant.tenantId, context.actor.userId, action, entityType, entityId, JSON.stringify(metadata || {})],
  );
}

async function queueWorkerAccessEmail(client, context, user) {
  const deliveryConfig = resolveEmailDeliveryConfig();
  const result = await client.query(
    `
      INSERT INTO email_deliveries (
        tenant_id, recipient_email, recipient_name, from_email, reply_to_email,
        subject, body_text, template_key, provider, status,
        related_entity_type, related_entity_id, metadata, queued_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'worker.temporary_access', $8, $9, 'user', $10, $11::jsonb, $12)
      RETURNING email_delivery_id, recipient_email, recipient_name, subject, template_key, provider, status,
                related_entity_type, related_entity_id, queued_at, sent_at
    `,
    [
      context.tenant.tenantId,
      user.email,
      user.display_name,
      deliveryConfig.fromEmail,
      deliveryConfig.replyToEmail,
      `Acceso trabajador a ${context.tenant.companyName}`,
      [
        `Hola ${user.display_name},`,
        `Tu administrador preparo tu acceso de trabajador para ${context.tenant.companyName}.`,
        `Usuario: ${user.email}`,
        "La contrasena temporal debe ser entregada por un canal seguro. No se almacena en este correo.",
      ].join("\n"),
      deliveryConfig.provider,
      deliveryConfig.status,
      user.user_id,
      JSON.stringify(createEmailMetadata({ passwordPersisted: false, source: "workforce-worker-users" })),
      context.actor.userId,
    ],
  );
  await writeAudit(client, context, `workforce.worker_user.email.${result.rows[0].status}`, "user", user.user_id, {
    emailDeliveryId: result.rows[0].email_delivery_id,
    templateKey: result.rows[0].template_key,
  });
  return {
    emailDeliveryId: result.rows[0].email_delivery_id,
    recipientEmail: result.rows[0].recipient_email,
    recipientName: result.rows[0].recipient_name || "",
    subject: result.rows[0].subject,
    templateKey: result.rows[0].template_key,
    provider: result.rows[0].provider,
    status: result.rows[0].status,
    relatedEntityType: result.rows[0].related_entity_type,
    relatedEntityId: result.rows[0].related_entity_id,
    queuedAt: result.rows[0].queued_at?.toISOString?.() || result.rows[0].queued_at || "",
    sentAt: result.rows[0].sent_at?.toISOString?.() || result.rows[0].sent_at || "",
  };
}

function validateWorkerInput(input, options = {}) {
  const partial = Boolean(options.partial);
  return {
    userId: nullableText(input?.userId, 80),
    name: optionalText(input?.name, 160, "Nombre de trabajador requerido.", partial),
    status: optionalEnum(input?.status, WORKER_STATUSES, "Estado de trabajador no valido.", true),
    trade: optionalText(input?.trade, 120, "Oficio no valido.", true),
    emergencyContactName: optionalText(input?.emergencyContactName, 160, "Contacto de emergencia no valido.", true),
    emergencyContactPhone: optionalText(input?.emergencyContactPhone, 60, "Telefono de emergencia no valido.", true),
    preferredLanguage: optionalEnum(input?.preferredLanguage || "es-US", LANGUAGES, "Idioma preferido no soportado.", true),
    notes: optionalText(input?.notes, 1000, "Notas demasiado largas.", true),
  };
}

function validateWorkerUserInput(input) {
  const password = nullableText(input?.password, 120);
  if (password && password.length < 14) {
    validationError("La contrasena temporal debe tener al menos 14 caracteres.");
  }
  return {
    workerId: nullableText(input?.workerId, 80),
    email: normalizeEmail(requiredText(input?.email, 180, "Correo requerido.")),
    name: requiredText(input?.name, 160, "Nombre de trabajador requerido."),
    password,
    trade: optionalText(input?.trade, 120, "Oficio no valido.", true),
    emergencyContactName: optionalText(input?.emergencyContactName, 160, "Contacto de emergencia no valido.", true),
    emergencyContactPhone: optionalText(input?.emergencyContactPhone, 60, "Telefono de emergencia no valido.", true),
    preferredLanguage: optionalEnum(input?.preferredLanguage || "es-US", LANGUAGES, "Idioma preferido no soportado.", true),
    notes: optionalText(input?.notes, 1000, "Notas demasiado largas.", true),
  };
}

function mapWorker(row) {
  return {
    workerId: row.worker_id,
    userId: row.user_id || null,
    userEmail: row.user_email || "",
    name: row.name,
    status: row.status,
    trade: row.trade || "",
    emergencyContactName: row.emergency_contact_name || "",
    emergencyContactPhone: row.emergency_contact_phone || "",
    preferredLanguage: row.preferred_language || "es-US",
    notes: row.notes || "",
    activeAssignments: Number(row.active_assignments || 0),
    documentAlerts: Number(row.document_alerts || 0),
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function mapAvailability(row) {
  return {
    availabilityId: row.availability_id,
    date: row.availability_date?.toISOString?.().slice(0, 10) || row.availability_date,
    status: AVAILABILITY_STATUSES.has(row.status) ? row.status : "available",
    notes: row.notes || "",
  };
}

function mapCertification(row) {
  return {
    certificationId: row.certification_id,
    name: row.name,
    status: CERTIFICATION_STATUSES.has(row.status) ? row.status : "pending_review",
    documentId: row.document_id || null,
    expiresAt: row.expires_at?.toISOString?.().slice(0, 10) || row.expires_at || "",
  };
}

function profileRowFromClean(clean) {
  return {
    emergency_contact_name: clean.emergencyContactName || "",
    emergency_contact_phone: clean.emergencyContactPhone || "",
    preferred_language: clean.preferredLanguage || "es-US",
    notes: clean.notes || "",
  };
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

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    validationError("Correo no valido.");
  }
  return email;
}

function generateTemporaryPassword() {
  return randomBytes(18).toString("base64url");
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
