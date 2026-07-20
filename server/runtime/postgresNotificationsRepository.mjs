import { createPostgresPoolFromEnv } from "./postgresAuthRepository.mjs";

const SEVERITIES = new Set(["info", "warning", "danger", "success"]);
const STATUSES = new Set(["pending", "delivered", "read", "resolved"]);
const EMAIL_STATUSES = new Set(["queued", "sent", "failed", "sandboxed"]);
const PREFERENCE_CHANNELS = new Set(["push_future", "email_future", "in_app_highlight"]);

const DEFAULT_NOTIFICATION_PREFERENCES = [
  { eventKey: "attendance.clock_in", label: "Entrada de trabajador", category: "Asistencia", channel: "push_future", enabled: true },
  { eventKey: "attendance.break_started", label: "Inicio de descanso", category: "Asistencia", channel: "push_future", enabled: true },
  { eventKey: "attendance.break_ended", label: "Fin de descanso", category: "Asistencia", channel: "push_future", enabled: true },
  { eventKey: "attendance.clock_out", label: "Salida de jornada", category: "Asistencia", channel: "push_future", enabled: true },
  { eventKey: "jobs.task.assigned", label: "Tarea asignada", category: "Obras", channel: "push_future", enabled: true },
  { eventKey: "worker.task.completed", label: "Checklist completado", category: "Obras", channel: "push_future", enabled: true },
  { eventKey: "worker.task.blocked", label: "Tarea bloqueada", category: "Obras", channel: "push_future", enabled: true },
  { eventKey: "invoices.overdue", label: "Factura vencida", category: "Facturacion", channel: "push_future", enabled: true },
  { eventKey: "documents.archive_due", label: "Archivo semestral pendiente", category: "Archivo", channel: "push_future", enabled: true },
  { eventKey: "documents.archive_completed", label: "Archivo semestral confirmado", category: "Archivo", channel: "push_future", enabled: true },
  { eventKey: "documents.cleanup_completed", label: "Limpieza segura completada", category: "Archivo", channel: "push_future", enabled: true },
  { eventKey: "security.permissions_changed", label: "Cambios de permisos o 2FA", category: "Seguridad", channel: "push_future", enabled: true },
];

export function createPostgresNotificationsRepositoryFromEnv(env = process.env) {
  const pool = createPostgresPoolFromEnv(env);
  if (!pool) {
    return null;
  }

  return {
    ...createPostgresNotificationsRepository(pool),
    async close() {
      await pool.end();
    },
  };
}

export function createPostgresNotificationsRepository(pool) {
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

  async function listNotifications(context, filters = {}) {
    return queryForTenant(context, async (client) => {
      const params = [context.tenant.tenantId, context.actor.userId];
      const where = ["nq.tenant_id = $1", "COALESCE(np.enabled, true) = true"];
      appendVisibleNotificationWhere(where, params, context, "nq", "$2");
      if (filters.role) {
        validateRequestedAudienceRole(context, filters.role);
        params.push(filters.role);
        where.push(`nq.audience_role = $${params.length}`);
      }
      if (filters.status && STATUSES.has(filters.status)) {
        params.push(filters.status);
        where.push(`nq.status = $${params.length}`);
      }
      const result = await client.query(
        `
          SELECT nq.notification_queue_id, nq.recipient_user_id, nq.audience_role, nq.channel, nq.event_key,
                 nq.title, nq.message, nq.severity, nq.related_entity_type, nq.related_entity_id,
                 nq.status, nq.attempts, nq.created_at, nq.delivered_at
          FROM notification_queue nq
          LEFT JOIN notification_preferences np
            ON np.tenant_id = nq.tenant_id
           AND np.user_id = $2
           AND np.event_key = nq.event_key
           AND np.channel = 'push_future'
          WHERE ${where.join(" AND ")}
          ORDER BY nq.created_at DESC
          LIMIT 150
        `,
        params,
      );
      const summary = await summarizeVisibleNotifications(client, context);
      return { items: result.rows.map(mapNotification), total: result.rowCount, summary };
    });
  }

  async function markNotificationRead(context, notificationId) {
    return queryForTenant(context, async (client) => {
      const params = [context.tenant.tenantId, notificationId, context.actor.userId];
      if (!canReadAllTenantNotifications(context)) {
        params.push(getActorNotificationRoles(context));
      }
      const result = await client.query(
        `
          UPDATE notification_queue
          SET status = 'read', delivered_at = COALESCE(delivered_at, now())
          WHERE tenant_id = $1
            AND notification_queue_id = $2
            AND ${visibleNotificationSql("notification_queue", "$3", "$4", context)}
            AND NOT EXISTS (
              SELECT 1
              FROM notification_preferences np
              WHERE np.tenant_id = notification_queue.tenant_id
                AND np.user_id = $3
                AND np.event_key = notification_queue.event_key
                AND np.channel = 'push_future'
                AND np.enabled = false
            )
          RETURNING notification_queue_id, recipient_user_id, audience_role, channel, title, message, severity,
                    event_key, related_entity_type, related_entity_id, status, attempts, created_at, delivered_at
        `,
        params,
      );
      if (!result.rows[0]) {
        notFound("Notificacion no encontrada para esta empresa.");
      }
      await writeAudit(client, context, "notifications.read", "notification", result.rows[0].notification_queue_id, {
        title: result.rows[0].title,
      });
      return mapNotification(result.rows[0]);
    });
  }

  async function markNotificationsRead(context, filters = {}) {
    return queryForTenant(context, async (client) => {
      const params = [context.tenant.tenantId, context.actor.userId];
      const where = [
        "nq.tenant_id = $1",
        "nq.status IN ('pending', 'delivered')",
        "COALESCE(np.enabled, true) = true",
      ];
      appendVisibleNotificationWhere(where, params, context, "nq", "$2");
      if (filters.role) {
        validateRequestedAudienceRole(context, filters.role);
        params.push(filters.role);
        where.push(`nq.audience_role = $${params.length}`);
      }
      if (filters.status && STATUSES.has(filters.status)) {
        params.push(filters.status);
        where.push(`nq.status = $${params.length}`);
      }
      const result = await client.query(
        `
          UPDATE notification_queue nq
          SET status = 'read', delivered_at = COALESCE(nq.delivered_at, now())
          FROM notification_queue source
          LEFT JOIN notification_preferences np
            ON np.tenant_id = source.tenant_id
           AND np.user_id = $2
           AND np.event_key = source.event_key
           AND np.channel = 'push_future'
          WHERE ${where.join(" AND ")}
            AND source.notification_queue_id = nq.notification_queue_id
          RETURNING nq.notification_queue_id
        `,
        params,
      );
      await writeAudit(client, context, "notifications.bulk_read", "notification", null, {
        role: filters.role || "",
        status: filters.status || "",
        updated: result.rowCount,
      });
      const summary = await summarizeVisibleNotifications(client, context);
      return { updated: result.rowCount, summary };
    });
  }

  async function listAuditEvents(context, filters = {}) {
    return queryForTenant(context, async (client) => {
      const params = [context.tenant.tenantId];
      const where = ["a.tenant_id = $1"];
      if (filters.moduleId) {
        params.push(filters.moduleId);
        where.push(`a.module_id = $${params.length}`);
      }
      const result = await client.query(
        `
          SELECT a.audit_event_id, a.actor_user_id, u.display_name AS actor_name, u.email AS actor_email,
                 a.action, a.module_id, a.entity_type, a.entity_id, a.severity, a.metadata, a.created_at
          FROM audit_events a
          LEFT JOIN users u ON u.tenant_id = a.tenant_id AND u.user_id = a.actor_user_id
          WHERE ${where.join(" AND ")}
          ORDER BY a.created_at DESC
          LIMIT 150
        `,
        params,
      );
      const summary = await summarizeAudit(client, context.tenant.tenantId);
      return { items: result.rows.map(mapAuditEvent), total: result.rowCount, summary };
    });
  }

  async function listEmailDeliveries(context, filters = {}) {
    return queryForTenant(context, async (client) => {
      const params = [context.tenant.tenantId];
      const where = ["ed.tenant_id = $1"];
      if (filters.status && EMAIL_STATUSES.has(filters.status)) {
        params.push(filters.status);
        where.push(`ed.status = $${params.length}`);
      }
      if (filters.search) {
        params.push(`%${String(filters.search).trim().toLowerCase()}%`);
        where.push(`(lower(ed.recipient_email) LIKE $${params.length} OR lower(ed.subject) LIKE $${params.length} OR lower(ed.template_key) LIKE $${params.length})`);
      }
      const result = await client.query(
        `
          SELECT email_delivery_id, recipient_email, recipient_name, from_email, reply_to_email,
                 subject, template_key, provider, status, related_entity_type, related_entity_id,
                 error_message, queued_by_user_id, attempt_count, next_attempt_at, last_attempt_at,
                 provider_message_id, worker_id, queued_at, sent_at, updated_at
          FROM email_deliveries ed
          WHERE ${where.join(" AND ")}
          ORDER BY queued_at DESC
          LIMIT 150
        `,
        params,
      );
      return { items: result.rows.map(mapEmailDelivery), total: result.rowCount };
    });
  }

  async function listNotificationPreferences(context) {
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          SELECT event_key, channel, enabled, updated_at
          FROM notification_preferences
          WHERE tenant_id = $1 AND user_id = $2
        `,
        [context.tenant.tenantId, context.actor.userId],
      );
      const overrides = new Map(result.rows.map((row) => [`${row.event_key}:${row.channel}`, row]));
      const items = DEFAULT_NOTIFICATION_PREFERENCES.map((item) => {
        const override = overrides.get(`${item.eventKey}:${item.channel}`);
        return {
          ...item,
          enabled: override ? Boolean(override.enabled) : item.enabled,
          updatedAt: override?.updated_at?.toISOString?.() || override?.updated_at || "",
        };
      });
      return { items };
    });
  }

  async function updateNotificationPreference(context, input = {}) {
    const eventKey = requiredPreferenceEvent(input.eventKey);
    const channel = requiredPreferenceChannel(input.channel);
    const enabled = Boolean(input.enabled);
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          INSERT INTO notification_preferences (tenant_id, user_id, event_key, channel, enabled)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (tenant_id, user_id, event_key, channel)
          DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now()
          RETURNING event_key, channel, enabled, updated_at
        `,
        [context.tenant.tenantId, context.actor.userId, eventKey, channel, enabled],
      );
      await writeAudit(client, context, "notifications.preference.updated", "notification_preference", null, {
        eventKey,
        channel,
        enabled,
      });
      const catalog = DEFAULT_NOTIFICATION_PREFERENCES.find((item) => item.eventKey === eventKey && item.channel === channel);
      return {
        eventKey,
        channel,
        label: catalog?.label || eventKey,
        category: catalog?.category || "General",
        enabled: Boolean(result.rows[0].enabled),
        updatedAt: result.rows[0].updated_at?.toISOString?.() || result.rows[0].updated_at || "",
      };
    });
  }

  return {
    listNotifications,
    markNotificationRead,
    markNotificationsRead,
    listAuditEvents,
    listEmailDeliveries,
    listNotificationPreferences,
    updateNotificationPreference,
  };
}

async function summarizeNotifications(client, tenantId) {
  const result = await client.query(
    `
      SELECT
        count(*)::integer AS total,
        count(*) FILTER (WHERE status = 'pending')::integer AS pending,
        count(*) FILTER (WHERE status = 'read')::integer AS read,
        count(*) FILTER (WHERE severity IN ('danger', 'warning'))::integer AS important
      FROM notification_queue
      WHERE tenant_id = $1
    `,
    [tenantId],
  );
  return {
    total: Number(result.rows[0]?.total || 0),
    pending: Number(result.rows[0]?.pending || 0),
    read: Number(result.rows[0]?.read || 0),
    important: Number(result.rows[0]?.important || 0),
  };
}

async function summarizeVisibleNotifications(client, context) {
  const params = [context.tenant.tenantId, context.actor.userId];
  if (!canReadAllTenantNotifications(context)) {
    params.push(getActorNotificationRoles(context));
  }
  const result = await client.query(
    `
      SELECT
        count(*)::integer AS total,
        count(*) FILTER (WHERE nq.status = 'pending')::integer AS pending,
        count(*) FILTER (WHERE nq.status = 'read')::integer AS read,
        count(*) FILTER (WHERE nq.severity IN ('danger', 'warning'))::integer AS important
      FROM notification_queue nq
      LEFT JOIN notification_preferences np
        ON np.tenant_id = nq.tenant_id
       AND np.user_id = $2
       AND np.event_key = nq.event_key
       AND np.channel = 'push_future'
      WHERE nq.tenant_id = $1
        AND ${visibleNotificationSql("nq", "$2", "$3", context)}
        AND COALESCE(np.enabled, true) = true
    `,
    params,
  );
  return {
    total: Number(result.rows[0]?.total || 0),
    pending: Number(result.rows[0]?.pending || 0),
    read: Number(result.rows[0]?.read || 0),
    important: Number(result.rows[0]?.important || 0),
  };
}

function getActorNotificationRoles(context) {
  const roles = Array.isArray(context?.actor?.roles) && context.actor.roles.length > 0 ? context.actor.roles : [context?.actor?.role];
  return roles.filter(Boolean);
}

function canReadAllTenantNotifications(context) {
  const roles = getActorNotificationRoles(context);
  return roles.includes("admin") || roles.includes("manager") || roles.includes("super_admin");
}

function validateRequestedAudienceRole(context, requestedRole) {
  if (canReadAllTenantNotifications(context)) {
    return;
  }
  if (!getActorNotificationRoles(context).includes(requestedRole)) {
    const error = new Error("No tienes permisos para consultar alertas de otro rol.");
    error.status = 403;
    error.code = "FORBIDDEN";
    throw error;
  }
}

function appendVisibleNotificationWhere(where, params, context, alias, recipientUserPlaceholder) {
  if (canReadAllTenantNotifications(context)) {
    where.push(`(${alias}.recipient_user_id IS NULL OR ${alias}.recipient_user_id = ${recipientUserPlaceholder})`);
    return;
  }

  params.push(getActorNotificationRoles(context));
  where.push(visibleNotificationSql(alias, recipientUserPlaceholder, `$${params.length}`, context));
}

function visibleNotificationSql(alias, recipientUserPlaceholder, actorRolesPlaceholder, context) {
  if (canReadAllTenantNotifications(context)) {
    return `(${alias}.recipient_user_id IS NULL OR ${alias}.recipient_user_id = ${recipientUserPlaceholder})`;
  }

  return `(${alias}.recipient_user_id = ${recipientUserPlaceholder} OR (${alias}.recipient_user_id IS NULL AND ${alias}.audience_role = ANY(${actorRolesPlaceholder})))`;
}

async function summarizeAudit(client, tenantId) {
  const result = await client.query(
    `
      SELECT
        count(*)::integer AS total,
        count(*) FILTER (WHERE severity = 'danger')::integer AS danger,
        count(DISTINCT module_id)::integer AS modules
      FROM audit_events
      WHERE tenant_id = $1
    `,
    [tenantId],
  );
  return {
    total: Number(result.rows[0]?.total || 0),
    danger: Number(result.rows[0]?.danger || 0),
    modules: Number(result.rows[0]?.modules || 0),
  };
}

async function writeAudit(client, context, action, entityType, entityId, metadata) {
  await client.query(
    `
      INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, $2, $3, 'notifications-audit-reports', $4, $5, 'info', $6::jsonb)
    `,
    [context.tenant.tenantId, context.actor.userId, action, entityType, entityId, JSON.stringify(metadata || {})],
  );
}

function mapNotification(row) {
  const severity = SEVERITIES.has(row.severity) ? row.severity : "info";
  return {
    notificationId: row.notification_queue_id,
    recipientUserId: row.recipient_user_id || null,
    audienceRole: row.audience_role,
    channel: row.channel,
    eventKey: row.event_key || "",
    title: row.title,
    message: row.message,
    severity,
    relatedEntityType: row.related_entity_type || "",
    relatedEntityId: row.related_entity_id || null,
    status: row.status,
    attempts: Number(row.attempts || 0),
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    deliveredAt: row.delivered_at?.toISOString?.() || row.delivered_at || "",
  };
}

function mapAuditEvent(row) {
  return {
    auditEventId: row.audit_event_id,
    actorUserId: row.actor_user_id || null,
    actorName: row.actor_name || row.actor_email || "Sistema",
    action: row.action,
    moduleId: row.module_id,
    entityType: row.entity_type || "",
    entityId: row.entity_id || null,
    severity: row.severity || "info",
    metadata: row.metadata || {},
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  };
}

function mapEmailDelivery(row) {
  return {
    emailDeliveryId: row.email_delivery_id,
    recipientEmail: row.recipient_email || "",
    recipientName: row.recipient_name || "",
    fromEmail: row.from_email || "",
    replyToEmail: row.reply_to_email || "",
    subject: row.subject || "",
    templateKey: row.template_key || "",
    provider: row.provider || "sandbox",
    status: row.status || "sandboxed",
    relatedEntityType: row.related_entity_type || "",
    relatedEntityId: row.related_entity_id || null,
    errorMessage: row.error_message || "",
    queuedByUserId: row.queued_by_user_id || null,
    attemptCount: Number(row.attempt_count || 0),
    nextAttemptAt: row.next_attempt_at?.toISOString?.() || row.next_attempt_at || "",
    lastAttemptAt: row.last_attempt_at?.toISOString?.() || row.last_attempt_at || "",
    providerMessageId: row.provider_message_id || "",
    workerId: row.worker_id || "",
    queuedAt: row.queued_at?.toISOString?.() || row.queued_at || "",
    sentAt: row.sent_at?.toISOString?.() || row.sent_at || "",
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at || "",
  };
}

function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  error.code = "NOT_FOUND";
  throw error;
}

function requiredPreferenceEvent(value) {
  const eventKey = String(value || "").trim();
  if (!DEFAULT_NOTIFICATION_PREFERENCES.some((item) => item.eventKey === eventKey)) {
    validationError("Tipo de notificacion no valido.");
  }
  return eventKey;
}

function requiredPreferenceChannel(value) {
  const channel = String(value || "").trim();
  if (!PREFERENCE_CHANNELS.has(channel)) {
    validationError("Canal de notificacion no valido.");
  }
  return channel;
}

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = "VALIDATION_ERROR";
  throw error;
}
