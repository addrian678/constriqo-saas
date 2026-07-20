import { createPostgresPoolFromEnv } from "./postgresAuthRepository.mjs";

const CLIENT_STATUSES = new Set(["lead", "active", "on_hold", "archived"]);
const ACTIVITY_TYPES = new Set(["call", "email", "meeting", "site_visit", "note"]);

export function createPostgresCrmRepositoryFromEnv(env = process.env) {
  const pool = createPostgresPoolFromEnv(env);
  if (!pool) {
    return null;
  }

  return {
    ...createPostgresCrmRepository(pool),
    async close() {
      await pool.end();
    },
  };
}

export function createPostgresCrmRepository(pool) {
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

  async function listClients(context, filters = {}) {
    return queryForTenant(context, async (client) => {
      const limit = clampNumber(filters.limit, 1, 100, 25);
      const offset = clampNumber(filters.offset, 0, 10_000, 0);
      const params = [context.tenant.tenantId];
      const where = ["tenant_id = $1"];

      if (filters.status && CLIENT_STATUSES.has(filters.status)) {
        params.push(filters.status);
        where.push(`status = $${params.length}`);
      } else {
        where.push("status <> 'archived'");
      }

      if (filters.search) {
        params.push(`%${filters.search.trim().toLowerCase()}%`);
        where.push(`(lower(name) LIKE $${params.length} OR lower(COALESCE(primary_contact, '')) LIKE $${params.length} OR lower(COALESCE(email, '')) LIKE $${params.length})`);
      }

      const whereSql = where.join(" AND ");
      const rows = await client.query(
        `
          SELECT client_id, tenant_id, name, status, primary_contact, phone, email, created_at, updated_at
          FROM clients
          WHERE ${whereSql}
          ORDER BY updated_at DESC, created_at DESC
          LIMIT $${params.length + 1}
          OFFSET $${params.length + 2}
        `,
        [...params, limit, offset],
      );
      const count = await client.query(`SELECT count(*)::integer AS total FROM clients WHERE ${whereSql}`, params);
      const summary = await client.query(
        `
          SELECT
            count(*) FILTER (WHERE status <> 'archived')::integer AS total,
            count(*) FILTER (WHERE status = 'lead')::integer AS leads,
            count(*) FILTER (WHERE status = 'active')::integer AS active,
            count(*) FILTER (WHERE status = 'on_hold')::integer AS on_hold,
            count(*) FILTER (WHERE status = 'archived')::integer AS archived
          FROM clients
          WHERE tenant_id = $1
        `,
        [context.tenant.tenantId],
      );

      return {
        items: rows.rows.map(mapClient),
        total: count.rows[0].total,
        limit,
        offset,
        summary: summary.rows[0],
      };
    });
  }

  async function getClient(context, clientId) {
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          SELECT client_id, tenant_id, name, status, primary_contact, phone, email, created_at, updated_at
          FROM clients
          WHERE tenant_id = $1 AND client_id = $2
        `,
        [context.tenant.tenantId, clientId],
      );

      if (!result.rows[0]) {
        return null;
      }

      const contacts = await client.query(
        `
          SELECT contact_id, name, role, phone, email, is_primary, created_at, updated_at
          FROM client_contacts
          WHERE tenant_id = $1 AND client_id = $2
          ORDER BY is_primary DESC, created_at DESC
        `,
        [context.tenant.tenantId, clientId],
      );
      const activities = await client.query(
        `
          SELECT activity_id, activity_type, status, title, due_at, assigned_to_user_id, created_by_user_id, created_at, updated_at
          FROM client_activities
          WHERE tenant_id = $1 AND client_id = $2
          ORDER BY created_at DESC
          LIMIT 50
        `,
        [context.tenant.tenantId, clientId],
      );
      const notes = await client.query(
        `
          SELECT note_id, body, created_by_user_id, created_at
          FROM client_notes
          WHERE tenant_id = $1 AND client_id = $2
          ORDER BY created_at DESC
          LIMIT 50
        `,
        [context.tenant.tenantId, clientId],
      );
      const estimates = await client.query(
        `
          SELECT estimate_id, estimate_number, status, total_amount, currency, updated_at
          FROM estimates
          WHERE tenant_id = $1 AND client_id = $2 AND status <> 'archived'
          ORDER BY updated_at DESC
          LIMIT 12
        `,
        [context.tenant.tenantId, clientId],
      );
      const jobs = await client.query(
        `
          SELECT job_id, job_number, title, status, updated_at
          FROM jobs
          WHERE tenant_id = $1 AND client_id = $2 AND status <> 'closed'
          ORDER BY updated_at DESC
          LIMIT 12
        `,
        [context.tenant.tenantId, clientId],
      );
      const invoices = await client.query(
        `
          SELECT invoice_id, invoice_number, title, status, total_amount, balance_amount, currency, created_at
          FROM invoices
          WHERE tenant_id = $1 AND client_id = $2 AND status <> 'void'
          ORDER BY created_at DESC
          LIMIT 12
        `,
        [context.tenant.tenantId, clientId],
      );

      return {
        client: mapClient(result.rows[0]),
        contacts: contacts.rows.map(mapContact),
        activities: activities.rows.map(mapActivity),
        notes: notes.rows.map(mapNote),
        related: {
          estimates: estimates.rows.map(mapRelatedEstimate),
          jobs: jobs.rows.map(mapRelatedJob),
          invoices: invoices.rows.map(mapRelatedInvoice),
        },
      };
    });
  }

  async function createClient(context, input) {
    const clean = validateClientInput(input, { partial: false });
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          INSERT INTO clients (tenant_id, name, status, primary_contact, phone, email)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING client_id, tenant_id, name, status, primary_contact, phone, email, created_at, updated_at
        `,
        [context.tenant.tenantId, clean.name, clean.status, clean.primaryContact, clean.phone, clean.email],
      );
      await writeAudit(client, context, "crm.clients.created", "client", result.rows[0].client_id, { name: clean.name });
      return mapClient(result.rows[0]);
    });
  }

  async function updateClient(context, clientId, input) {
    const clean = validateClientInput(input, { partial: true });
    return queryForTenant(context, async (client) => {
      const current = await client.query("SELECT client_id FROM clients WHERE tenant_id = $1 AND client_id = $2", [
        context.tenant.tenantId,
        clientId,
      ]);
      if (!current.rows[0]) {
        return null;
      }

      const result = await client.query(
        `
          UPDATE clients
          SET
            name = COALESCE($3, name),
            status = COALESCE($4, status),
            primary_contact = COALESCE($5, primary_contact),
            phone = COALESCE($6, phone),
            email = COALESCE($7, email),
            updated_at = now()
          WHERE tenant_id = $1 AND client_id = $2
          RETURNING client_id, tenant_id, name, status, primary_contact, phone, email, created_at, updated_at
        `,
        [
          context.tenant.tenantId,
          clientId,
          clean.name,
          clean.status,
          clean.primaryContact,
          clean.phone,
          clean.email,
        ],
      );
      await writeAudit(client, context, "crm.clients.updated", "client", clientId, { fields: Object.keys(clean) });
      return mapClient(result.rows[0]);
    });
  }

  async function archiveClient(context, clientId) {
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          UPDATE clients
          SET status = 'archived', updated_at = now()
          WHERE tenant_id = $1 AND client_id = $2
          RETURNING client_id, tenant_id, name, status, primary_contact, phone, email, created_at, updated_at
        `,
        [context.tenant.tenantId, clientId],
      );
      if (!result.rows[0]) {
        return null;
      }

      await writeAudit(client, context, "crm.clients.archived", "client", clientId, {});
      return mapClient(result.rows[0]);
    });
  }

  async function createActivity(context, input) {
    const clean = validateActivityInput(input);
    return queryForTenant(context, async (client) => {
      await requireClientForTenant(client, context, clean.clientId);
      const result = await client.query(
        `
          INSERT INTO client_activities (tenant_id, client_id, activity_type, status, title, due_at, assigned_to_user_id, created_by_user_id)
          VALUES ($1, $2, $3, 'open', $4, $5, $6, $7)
          RETURNING activity_id, activity_type, status, title, due_at, assigned_to_user_id, created_by_user_id, created_at, updated_at
        `,
        [
          context.tenant.tenantId,
          clean.clientId,
          clean.type,
          clean.title,
          clean.dueAt,
          clean.assignedToUserId,
          context.actor.userId,
        ],
      );
      await writeAudit(client, context, "crm.activities.created", "client_activity", result.rows[0].activity_id, {
        clientId: clean.clientId,
      });
      return mapActivity(result.rows[0]);
    });
  }

  async function createNote(context, clientId, input) {
    const body = String(input?.body || "").trim();
    if (body.length < 2 || body.length > 2000) {
      validationError("La nota debe tener entre 2 y 2000 caracteres.");
    }

    return queryForTenant(context, async (client) => {
      await requireClientForTenant(client, context, clientId);
      const result = await client.query(
        `
          INSERT INTO client_notes (tenant_id, client_id, body, created_by_user_id)
          VALUES ($1, $2, $3, $4)
          RETURNING note_id, body, created_by_user_id, created_at
        `,
        [context.tenant.tenantId, clientId, body, context.actor.userId],
      );
      await writeAudit(client, context, "crm.notes.created", "client_note", result.rows[0].note_id, { clientId });
      return mapNote(result.rows[0]);
    });
  }

  return {
    listClients,
    getClient,
    createClient,
    updateClient,
    archiveClient,
    createActivity,
    createNote,
  };
}

async function requireClientForTenant(client, context, clientId) {
  const result = await client.query("SELECT client_id FROM clients WHERE tenant_id = $1 AND client_id = $2", [
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

async function writeAudit(client, context, action, entityType, entityId, metadata) {
  await client.query(
    `
      INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, $2, $3, 'crm', $4, $5, 'info', $6::jsonb)
    `,
    [context.tenant.tenantId, context.actor.userId, action, entityType, entityId, JSON.stringify(metadata || {})],
  );
}

function validateClientInput(input, { partial }) {
  const clean = {};

  if (!partial || input?.name !== undefined) {
    clean.name = String(input?.name || "").trim();
    if (clean.name.length < 2 || clean.name.length > 160) {
      validationError("El nombre del cliente debe tener entre 2 y 160 caracteres.");
    }
  }

  if (!partial || input?.status !== undefined) {
    clean.status = String(input?.status || "lead");
    if (!CLIENT_STATUSES.has(clean.status)) {
      validationError("Estado de cliente no valido.");
    }
  }

  if (input?.primaryContact !== undefined) {
    clean.primaryContact = nullableText(input.primaryContact, 120);
  }
  if (input?.phone !== undefined) {
    clean.phone = nullableText(input.phone, 60);
  }
  if (input?.email !== undefined) {
    clean.email = nullableText(input.email, 180)?.toLowerCase();
  }

  return clean;
}

function validateActivityInput(input) {
  const clientId = String(input?.clientId || "");
  const type = String(input?.type || "note");
  const title = String(input?.title || "").trim();

  if (!clientId) {
    validationError("clientId es obligatorio.");
  }
  if (!ACTIVITY_TYPES.has(type)) {
    validationError("Tipo de actividad no valido.");
  }
  if (title.length < 2 || title.length > 180) {
    validationError("El titulo de actividad debe tener entre 2 y 180 caracteres.");
  }

  return {
    clientId,
    type,
    title,
    dueAt: input?.dueAt || null,
    assignedToUserId: input?.assignedToUserId || null,
  };
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

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

function mapClient(row) {
  return {
    clientId: row.client_id,
    tenantId: row.tenant_id,
    name: row.name,
    status: row.status,
    primaryContact: row.primary_contact || "",
    phone: row.phone || "",
    email: row.email || "",
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function mapContact(row) {
  return {
    contactId: row.contact_id,
    name: row.name,
    role: row.role || "",
    phone: row.phone || "",
    email: row.email || "",
    isPrimary: Boolean(row.is_primary),
  };
}

function mapActivity(row) {
  return {
    activityId: row.activity_id,
    type: row.activity_type,
    status: row.status,
    title: row.title,
    dueAt: row.due_at?.toISOString?.() || row.due_at,
    assignedToUserId: row.assigned_to_user_id || "",
    createdByUserId: row.created_by_user_id || "",
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function mapNote(row) {
  return {
    noteId: row.note_id,
    body: row.body,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  };
}

function mapRelatedEstimate(row) {
  return {
    estimateId: row.estimate_id,
    estimateNumber: row.estimate_number,
    status: row.status,
    totalAmount: Number(row.total_amount || 0),
    currency: row.currency || "USD",
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function mapRelatedJob(row) {
  return {
    jobId: row.job_id,
    jobNumber: row.job_number,
    title: row.title,
    status: row.status,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function mapRelatedInvoice(row) {
  return {
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    title: row.title || row.invoice_number,
    status: row.status,
    totalAmount: Number(row.total_amount || 0),
    balanceAmount: Number(row.balance_amount || 0),
    currency: row.currency || "USD",
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  };
}
