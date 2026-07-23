import { createPostgresPoolFromEnv } from "./postgresAuthRepository.mjs";

const ENTRY_STATUSES = new Set(["active", "on_break", "submitted", "approved", "rejected", "cancelled"]);
const REVIEW_STATUSES = new Set(["approved", "rejected"]);

export function createPostgresAttendanceRepositoryFromEnv(env = process.env) {
  const pool = createPostgresPoolFromEnv(env);
  if (!pool) {
    return null;
  }

  return {
    ...createPostgresAttendanceRepository(pool),
    async close() {
      await pool.end();
    },
  };
}

export function createPostgresAttendanceRepository(pool) {
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

  async function listTimeEntries(context, filters = {}) {
    return queryForTenant(context, async (client) => {
      const params = [context.tenant.tenantId];
      const where = ["te.tenant_id = $1"];
      if (filters.status && ENTRY_STATUSES.has(filters.status)) {
        params.push(filters.status);
        where.push(`te.status = $${params.length}`);
      }
      if (filters.workerId) {
        params.push(String(filters.workerId));
        where.push(`te.worker_id = $${params.length}`);
      }
      const result = await client.query(
        `
          SELECT te.time_entry_id, te.worker_id, w.name AS worker_name, te.job_id, j.job_number, j.title AS job_title,
                 te.clock_in, te.clock_out, te.status, te.submitted_at, te.server_recorded,
                 te.clock_in_lat, te.clock_in_lng, te.clock_in_accuracy_m,
                 te.clock_out_lat, te.clock_out_lng, te.clock_out_accuracy_m,
                 te.clock_in_note, te.clock_out_note, te.job_distance_meters, te.location_status, te.created_at,
                 te.cancelled_at, te.cancelled_by_user_id, te.cancel_reason, te.payroll_status,
                 COALESCE(sum(EXTRACT(EPOCH FROM (COALESCE(be.ended_at, now()) - be.started_at))) FILTER (WHERE be.status IN ('closed', 'open')), 0)::integer AS break_seconds,
                 open_break.break_entry_id AS active_break_id,
                 open_break.started_at AS active_break_started_at,
                 open_break.planned_minutes AS active_break_planned_minutes
          FROM time_entries te
          JOIN workers w ON w.tenant_id = te.tenant_id AND w.worker_id = te.worker_id
          LEFT JOIN jobs j ON j.tenant_id = te.tenant_id AND j.job_id = te.job_id
          LEFT JOIN break_entries be ON be.tenant_id = te.tenant_id AND be.time_entry_id = te.time_entry_id
          LEFT JOIN LATERAL (
            SELECT break_entry_id, started_at, planned_minutes
            FROM break_entries
            WHERE tenant_id = te.tenant_id AND time_entry_id = te.time_entry_id AND status = 'open'
            ORDER BY started_at DESC
            LIMIT 1
          ) open_break ON true
          WHERE ${where.join(" AND ")}
          GROUP BY te.time_entry_id, w.name, j.job_number, j.title, open_break.break_entry_id, open_break.started_at, open_break.planned_minutes
          ORDER BY te.clock_in DESC
          LIMIT 150
        `,
        params,
      );
      const summary = await client.query(
        `
          SELECT
            count(*)::integer AS total,
            count(*) FILTER (WHERE status IN ('active', 'on_break'))::integer AS open,
            count(*) FILTER (WHERE status = 'submitted')::integer AS submitted,
            count(*) FILTER (WHERE status = 'approved')::integer AS approved,
            count(*) FILTER (WHERE location_status = 'outside_radius')::integer AS outside_radius,
            count(*) FILTER (WHERE location_status IN ('missing_worker_location', 'job_without_location'))::integer AS location_warnings,
            count(*) FILTER (WHERE status = 'cancelled')::integer AS cancelled
          FROM time_entries
          WHERE tenant_id = $1
        `,
        [context.tenant.tenantId],
      );
      return { items: result.rows.map(mapTimeEntry), total: result.rowCount, summary: summary.rows[0] || {} };
    });
  }

  async function getMyAttendance(context) {
    return queryForTenant(context, async (client) => {
      const worker = await resolveWorkerForActor(client, context);
      const entries = await listWorkerEntries(client, context.tenant.tenantId, worker.worker_id);
      const openEntry = entries.find((entry) => entry.status === "active" || entry.status === "on_break") || null;
      return {
        worker: mapWorker(worker),
        openEntry,
        recentEntries: entries,
        summary: {
          total: entries.length,
          open: openEntry ? 1 : 0,
          submitted: entries.filter((entry) => entry.status === "submitted").length,
          approved: entries.filter((entry) => entry.status === "approved").length,
        },
      };
    });
  }

  async function clockIn(context, input = {}) {
    const clean = validateClockInput(input, { jobOptional: false });
    return queryForTenant(context, async (client) => {
      const worker = await resolveWorkerForActor(client, context);
      const open = await findOpenEntry(client, context.tenant.tenantId, worker.worker_id);
      if (open) {
        validationError("Ya tienes una jornada abierta.");
      }
      let jobLocation = null;
      if (clean.jobId) {
        jobLocation = await requireJobForTenant(client, context.tenant.tenantId, clean.jobId);
      }
      const locationCheck = evaluateJobLocation(clean.location, jobLocation);
      const result = await client.query(
        `
          INSERT INTO time_entries (
            tenant_id, worker_id, job_id, clock_in, status,
            clock_in_lat, clock_in_lng, clock_in_accuracy_m, clock_in_note,
            job_distance_meters, location_status
          )
          VALUES ($1, $2, $3, now(), 'active', $4, $5, $6, $7, $8, $9)
          RETURNING time_entry_id
        `,
        [
          context.tenant.tenantId,
          worker.worker_id,
          clean.jobId,
          clean.location?.lat || null,
          clean.location?.lng || null,
          clean.location?.accuracyM || null,
          clean.note,
          locationCheck.distanceMeters,
          locationCheck.status,
        ],
      );
      const entry = await getTimeEntryById(client, context.tenant.tenantId, result.rows[0].time_entry_id);
      await writeAudit(client, context, "attendance.clock_in", "time_entry", entry.timeEntryId, {
        workerId: worker.worker_id,
        jobId: clean.jobId,
        hasLocation: Boolean(clean.location),
        locationStatus: locationCheck.status,
        distanceMeters: locationCheck.distanceMeters,
      });
      const isOutside = locationCheck.status === "outside_radius";
      await enqueueNotificationForRoles(
        client,
        context.tenant.tenantId,
        ["admin", "manager"],
        isOutside ? "Entrada fuera de radio" : "Entrada registrada",
        isOutside
          ? `${worker.name} inicio jornada fuera del radio de la obra (${locationCheck.distanceMeters} m).`
          : `${worker.name} inicio jornada.`,
        isOutside ? "warning" : "info",
        entry.timeEntryId,
        "attendance.clock_in",
      );
      return entry;
    });
  }

  async function cancelEntry(context, input = {}) {
    const reason = nullableText(input.reason, 500);
    return queryForTenant(context, async (client) => {
      const worker = await resolveWorkerForActor(client, context);
      const open = await findOpenEntry(client, context.tenant.tenantId, worker.worker_id);
      if (!open) {
        validationError("No tienes una entrada activa para cancelar.");
      }
      if (open.status === "on_break") {
        validationError("No se puede cancelar una entrada con descanso iniciado. Finaliza la jornada con salida.");
      }
      const breakCount = await client.query(
        "SELECT count(*)::integer AS total FROM break_entries WHERE tenant_id = $1 AND time_entry_id = $2",
        [context.tenant.tenantId, open.time_entry_id],
      );
      if (Number(breakCount.rows[0]?.total || 0) > 0) {
        validationError("No se puede cancelar una entrada que ya tiene descansos registrados.");
      }
      await client.query(
        `
          UPDATE time_entries
          SET status = 'cancelled',
              clock_out = COALESCE(clock_out, now()),
              cancelled_at = now(),
              cancelled_by_user_id = $3,
              cancel_reason = $4,
              payroll_status = 'excluded'
          WHERE tenant_id = $1 AND time_entry_id = $2
        `,
        [context.tenant.tenantId, open.time_entry_id, context.actor.userId, reason],
      );
      const entry = await getTimeEntryById(client, context.tenant.tenantId, open.time_entry_id);
      await writeAudit(client, context, "attendance.clock_in_cancelled", "time_entry", entry.timeEntryId, { workerId: worker.worker_id, reason: reason || "" });
      await enqueueNotificationForRoles(client, context.tenant.tenantId, ["admin", "manager"], "Entrada cancelada", `${worker.name} cancelo una entrada registrada.`, "warning", entry.timeEntryId, "attendance.clock_in_cancelled");
      return entry;
    });
  }

  async function startBreak(context, input = {}) {
    const plannedMinutes = validateBreakStartInput(input).plannedMinutes;
    return queryForTenant(context, async (client) => {
      const worker = await resolveWorkerForActor(client, context);
      const open = await findOpenEntry(client, context.tenant.tenantId, worker.worker_id);
      if (!open) {
        validationError("No tienes una jornada abierta.");
      }
      if (open.status === "on_break") {
        validationError("Ya tienes un descanso abierto.");
      }
      await client.query(
        "INSERT INTO break_entries (tenant_id, time_entry_id, started_at, status, planned_minutes) VALUES ($1, $2, now(), 'open', $3)",
        [context.tenant.tenantId, open.time_entry_id, plannedMinutes],
      );
      await client.query("UPDATE time_entries SET status = 'on_break' WHERE tenant_id = $1 AND time_entry_id = $2", [context.tenant.tenantId, open.time_entry_id]);
      const entry = await getTimeEntryById(client, context.tenant.tenantId, open.time_entry_id);
      await writeAudit(client, context, "attendance.break_started", "time_entry", entry.timeEntryId, { workerId: worker.worker_id, plannedMinutes });
      await enqueueNotificationForRoles(client, context.tenant.tenantId, ["admin", "manager"], "Descanso iniciado", `${worker.name} inicio descanso por ${plannedMinutes} minutos.`, "info", entry.timeEntryId, "attendance.break_started");
      return entry;
    });
  }

  async function endBreak(context) {
    return queryForTenant(context, async (client) => {
      const worker = await resolveWorkerForActor(client, context);
      const open = await findOpenEntry(client, context.tenant.tenantId, worker.worker_id);
      if (!open || open.status !== "on_break") {
        validationError("No tienes un descanso abierto.");
      }
      const breakEntry = await client.query(
        "UPDATE break_entries SET ended_at = now(), status = 'closed' WHERE tenant_id = $1 AND time_entry_id = $2 AND status = 'open' RETURNING break_entry_id",
        [context.tenant.tenantId, open.time_entry_id],
      );
      if (!breakEntry.rows[0]) {
        validationError("No se encontro descanso abierto.");
      }
      await client.query("UPDATE time_entries SET status = 'active' WHERE tenant_id = $1 AND time_entry_id = $2", [context.tenant.tenantId, open.time_entry_id]);
      const entry = await getTimeEntryById(client, context.tenant.tenantId, open.time_entry_id);
      await writeAudit(client, context, "attendance.break_ended", "time_entry", entry.timeEntryId, { workerId: worker.worker_id });
      await enqueueNotificationForRoles(client, context.tenant.tenantId, ["admin", "manager"], "Descanso finalizado", `${worker.name} finalizo descanso.`, "info", entry.timeEntryId, "attendance.break_ended");
      return entry;
    });
  }

  async function clockOut(context, input = {}) {
    const clean = validateClockInput(input, { jobOptional: true });
    return queryForTenant(context, async (client) => {
      const worker = await resolveWorkerForActor(client, context);
      const open = await findOpenEntry(client, context.tenant.tenantId, worker.worker_id);
      if (!open) {
        validationError("No tienes una jornada abierta.");
      }
      await client.query(
        "UPDATE break_entries SET ended_at = COALESCE(ended_at, now()), status = 'closed' WHERE tenant_id = $1 AND time_entry_id = $2 AND status = 'open'",
        [context.tenant.tenantId, open.time_entry_id],
      );
      await client.query(
        `
          UPDATE time_entries
          SET clock_out = now(),
              status = 'submitted',
              submitted_at = now(),
              clock_out_lat = $3,
              clock_out_lng = $4,
              clock_out_accuracy_m = $5,
              clock_out_note = $6
          WHERE tenant_id = $1 AND time_entry_id = $2
        `,
        [context.tenant.tenantId, open.time_entry_id, clean.location?.lat || null, clean.location?.lng || null, clean.location?.accuracyM || null, clean.note],
      );
      const entry = await getTimeEntryById(client, context.tenant.tenantId, open.time_entry_id);
      await writeAudit(client, context, "attendance.clock_out", "time_entry", entry.timeEntryId, {
        workerId: worker.worker_id,
        hasLocation: Boolean(clean.location),
      });
      await enqueueNotificationForRoles(client, context.tenant.tenantId, ["admin", "manager"], "Salida registrada", `${worker.name} finalizo jornada.`, "info", entry.timeEntryId, "attendance.clock_out");
      return entry;
    });
  }

  async function reviewTimeEntry(context, timeEntryId, input = {}) {
    const status = validateReviewStatus(input.status || "approved");
    const notes = nullableText(input.notes, 500);
    return queryForTenant(context, async (client) => {
      const existing = await getTimeEntryById(client, context.tenant.tenantId, timeEntryId);
      if (!existing) {
        notFound("Registro horario no encontrado.");
      }
      await client.query(
        `
          INSERT INTO attendance_approvals (tenant_id, time_entry_id, status, reviewed_by_user_id, notes)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [context.tenant.tenantId, timeEntryId, status, context.actor.userId, notes],
      );
      await client.query("UPDATE time_entries SET status = $3 WHERE tenant_id = $1 AND time_entry_id = $2", [context.tenant.tenantId, timeEntryId, status]);
      const entry = await getTimeEntryById(client, context.tenant.tenantId, timeEntryId);
      await writeAudit(client, context, "attendance.reviewed", "time_entry", timeEntryId, { status, notes: notes || "" });
      return entry;
    });
  }

  return {
    listTimeEntries,
    getMyAttendance,
    clockIn,
    cancelEntry,
    startBreak,
    endBreak,
    clockOut,
    reviewTimeEntry,
  };
}

async function listWorkerEntries(client, tenantId, workerId) {
  const result = await client.query(
    `
      SELECT te.time_entry_id, te.worker_id, w.name AS worker_name, te.job_id, j.job_number, j.title AS job_title,
             te.clock_in, te.clock_out, te.status, te.submitted_at, te.server_recorded,
             te.clock_in_lat, te.clock_in_lng, te.clock_in_accuracy_m,
             te.clock_out_lat, te.clock_out_lng, te.clock_out_accuracy_m,
             te.clock_in_note, te.clock_out_note, te.job_distance_meters, te.location_status, te.created_at,
             te.cancelled_at, te.cancelled_by_user_id, te.cancel_reason, te.payroll_status,
             COALESCE(sum(EXTRACT(EPOCH FROM (COALESCE(be.ended_at, now()) - be.started_at))) FILTER (WHERE be.status IN ('closed', 'open')), 0)::integer AS break_seconds,
             open_break.break_entry_id AS active_break_id,
             open_break.started_at AS active_break_started_at,
             open_break.planned_minutes AS active_break_planned_minutes
      FROM time_entries te
      JOIN workers w ON w.tenant_id = te.tenant_id AND w.worker_id = te.worker_id
      LEFT JOIN jobs j ON j.tenant_id = te.tenant_id AND j.job_id = te.job_id
      LEFT JOIN break_entries be ON be.tenant_id = te.tenant_id AND be.time_entry_id = te.time_entry_id
      LEFT JOIN LATERAL (
        SELECT break_entry_id, started_at, planned_minutes
        FROM break_entries
        WHERE tenant_id = te.tenant_id AND time_entry_id = te.time_entry_id AND status = 'open'
        ORDER BY started_at DESC
        LIMIT 1
      ) open_break ON true
      WHERE te.tenant_id = $1 AND te.worker_id = $2
      GROUP BY te.time_entry_id, w.name, j.job_number, j.title, open_break.break_entry_id, open_break.started_at, open_break.planned_minutes
      ORDER BY te.clock_in DESC
      LIMIT 30
    `,
    [tenantId, workerId],
  );
  return result.rows.map(mapTimeEntry);
}

async function getTimeEntryById(client, tenantId, timeEntryId) {
  const result = await client.query(
    `
      SELECT te.time_entry_id, te.worker_id, w.name AS worker_name, te.job_id, j.job_number, j.title AS job_title,
             te.clock_in, te.clock_out, te.status, te.submitted_at, te.server_recorded,
             te.clock_in_lat, te.clock_in_lng, te.clock_in_accuracy_m,
             te.clock_out_lat, te.clock_out_lng, te.clock_out_accuracy_m,
             te.clock_in_note, te.clock_out_note, te.job_distance_meters, te.location_status, te.created_at,
             te.cancelled_at, te.cancelled_by_user_id, te.cancel_reason, te.payroll_status,
             COALESCE(sum(EXTRACT(EPOCH FROM (COALESCE(be.ended_at, now()) - be.started_at))) FILTER (WHERE be.status IN ('closed', 'open')), 0)::integer AS break_seconds,
             open_break.break_entry_id AS active_break_id,
             open_break.started_at AS active_break_started_at,
             open_break.planned_minutes AS active_break_planned_minutes
      FROM time_entries te
      JOIN workers w ON w.tenant_id = te.tenant_id AND w.worker_id = te.worker_id
      LEFT JOIN jobs j ON j.tenant_id = te.tenant_id AND j.job_id = te.job_id
      LEFT JOIN break_entries be ON be.tenant_id = te.tenant_id AND be.time_entry_id = te.time_entry_id
      LEFT JOIN LATERAL (
        SELECT break_entry_id, started_at, planned_minutes
        FROM break_entries
        WHERE tenant_id = te.tenant_id AND time_entry_id = te.time_entry_id AND status = 'open'
        ORDER BY started_at DESC
        LIMIT 1
      ) open_break ON true
      WHERE te.tenant_id = $1 AND te.time_entry_id = $2
      GROUP BY te.time_entry_id, w.name, j.job_number, j.title, open_break.break_entry_id, open_break.started_at, open_break.planned_minutes
    `,
    [tenantId, timeEntryId],
  );
  return result.rows[0] ? mapTimeEntry(result.rows[0]) : null;
}

async function findOpenEntry(client, tenantId, workerId) {
  const result = await client.query(
    "SELECT time_entry_id, status FROM time_entries WHERE tenant_id = $1 AND worker_id = $2 AND clock_out IS NULL AND status IN ('active', 'on_break') ORDER BY clock_in DESC LIMIT 1",
    [tenantId, workerId],
  );
  return result.rows[0] || null;
}

async function resolveWorkerForActor(client, context) {
  const result = await client.query(
    "SELECT worker_id, user_id, name, status FROM workers WHERE tenant_id = $1 AND user_id = $2 AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    [context.tenant.tenantId, context.actor.userId],
  );
  if (!result.rows[0]) {
    forbidden("Tu usuario no tiene un perfil de trabajador activo en esta empresa.");
  }
  return result.rows[0];
}

async function requireJobForTenant(client, tenantId, jobId) {
  const result = await client.query(
    "SELECT job_id, project_latitude, project_longitude, allowed_radius_meters FROM jobs WHERE tenant_id = $1 AND job_id = $2 AND status <> 'closed'",
    [tenantId, jobId],
  );
  if (!result.rows[0]) {
    notFound("Obra activa no encontrada para esta empresa.");
  }
  return {
    latitude: result.rows[0].project_latitude === null || result.rows[0].project_latitude === undefined ? null : Number(result.rows[0].project_latitude),
    longitude: result.rows[0].project_longitude === null || result.rows[0].project_longitude === undefined ? null : Number(result.rows[0].project_longitude),
    allowedRadiusMeters: Number(result.rows[0].allowed_radius_meters || 250),
  };
}

async function writeAudit(client, context, action, entityType, entityId, metadata) {
  await client.query(
    `
      INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, $2, $3, 'attendance', $4, $5, 'info', $6::jsonb)
    `,
    [context.tenant.tenantId, context.actor.userId, action, entityType, entityId, JSON.stringify(metadata || {})],
  );
}

async function enqueueNotification(client, tenantId, audienceRole, title, message, severity, relatedId, eventKey) {
  await client.query(
    `
      INSERT INTO notification_queue (tenant_id, audience_role, channel, event_key, title, message, severity, related_entity_type, related_entity_id)
      VALUES ($1, $2, 'in_app', $3, $4, $5, $6, 'time_entry', $7)
    `,
    [tenantId, audienceRole, eventKey, title, message, severity, relatedId],
  );
}

async function enqueueNotificationForRoles(client, tenantId, audienceRoles, title, message, severity, relatedId, eventKey) {
  for (const audienceRole of Array.from(new Set(audienceRoles))) {
    await enqueueNotification(client, tenantId, audienceRole, title, message, severity, relatedId, eventKey);
  }
}

function validateClockInput(input, options = {}) {
  return {
    jobId: options.jobOptional ? nullableText(input?.jobId, 80) : requiredText(input?.jobId, 80, "Obra requerida."),
    note: nullableText(input?.note, 500),
    location: validateLocation(input?.location),
  };
}

function validateBreakStartInput(input = {}) {
  const plannedMinutes = Number(input.plannedMinutes || 0);
  if (!Number.isInteger(plannedMinutes) || ![30, 60, 120].includes(plannedMinutes)) {
    validationError("Selecciona un descanso valido de 30, 60 o 120 minutos.");
  }
  return { plannedMinutes };
}

function validateLocation(value) {
  if (!value || value.lat === undefined || value.lng === undefined) {
    return null;
  }
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  const accuracyM = value.accuracyM === undefined || value.accuracyM === null ? null : Number(value.accuracyM);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    validationError("Ubicacion no valida.");
  }
  if (accuracyM !== null && (!Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > 100000)) {
    validationError("Precision de ubicacion no valida.");
  }
  return { lat, lng, accuracyM };
}

function validateReviewStatus(value) {
  const status = String(value || "").trim();
  if (!REVIEW_STATUSES.has(status)) {
    validationError("Estado de revision no valido.");
  }
  return status;
}

function mapTimeEntry(row) {
  const breakSeconds = Number(row.break_seconds || 0);
  const grossSeconds = row.clock_out ? Math.max(0, (new Date(row.clock_out).getTime() - new Date(row.clock_in).getTime()) / 1000) : 0;
  return {
    timeEntryId: row.time_entry_id,
    workerId: row.worker_id,
    workerName: row.worker_name || "",
    jobId: row.job_id || null,
    jobNumber: row.job_number || "",
    jobTitle: row.job_title || "",
    clockIn: row.clock_in?.toISOString?.() || row.clock_in,
    clockOut: row.clock_out?.toISOString?.() || row.clock_out || "",
    status: row.status,
    submittedAt: row.submitted_at?.toISOString?.() || row.submitted_at || "",
    serverRecorded: Boolean(row.server_recorded),
    breakSeconds,
    totalSeconds: row.clock_out ? Math.max(0, Math.round(grossSeconds - breakSeconds)) : 0,
    activeBreak: row.active_break_id
      ? {
          breakEntryId: row.active_break_id,
          startedAt: row.active_break_started_at?.toISOString?.() || row.active_break_started_at,
          plannedMinutes: Number(row.active_break_planned_minutes || 0),
        }
      : null,
    clockInLocation: mapLocation(row.clock_in_lat, row.clock_in_lng, row.clock_in_accuracy_m),
    clockOutLocation: mapLocation(row.clock_out_lat, row.clock_out_lng, row.clock_out_accuracy_m),
    jobDistanceMeters: row.job_distance_meters === null || row.job_distance_meters === undefined ? null : Number(row.job_distance_meters),
    locationStatus: row.location_status || "not_checked",
    clockInNote: row.clock_in_note || "",
    clockOutNote: row.clock_out_note || "",
    cancelledAt: row.cancelled_at?.toISOString?.() || row.cancelled_at || "",
    cancelReason: row.cancel_reason || "",
    payrollStatus: row.payroll_status || "unpaid",
  };
}

function mapWorker(row) {
  return {
    workerId: row.worker_id,
    userId: row.user_id || null,
    name: row.name,
    status: row.status,
  };
}

function mapLocation(lat, lng, accuracyM) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) {
    return null;
  }
  return {
    lat: Number(lat),
    lng: Number(lng),
    accuracyM: accuracyM === null || accuracyM === undefined ? null : Number(accuracyM),
  };
}

function evaluateJobLocation(location, jobLocation) {
  if (!jobLocation || jobLocation.latitude === null || jobLocation.longitude === null) {
    return { status: "job_without_location", distanceMeters: null };
  }
  if (!location) {
    return { status: "missing_worker_location", distanceMeters: null };
  }
  const distanceMeters = Math.round(distanceBetweenMeters(location.lat, location.lng, jobLocation.latitude, jobLocation.longitude));
  return {
    distanceMeters,
    status: distanceMeters <= jobLocation.allowedRadiusMeters ? "inside_radius" : "outside_radius",
  };
}

function distanceBetweenMeters(lat1, lng1, lat2, lng2) {
  const earthRadiusMeters = 6371000;
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

function forbidden(message) {
  const error = new Error(message);
  error.status = 403;
  error.code = "FORBIDDEN";
  throw error;
}
