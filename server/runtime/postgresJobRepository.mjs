import { createPostgresPoolFromEnv } from "./postgresAuthRepository.mjs";
import { nextDocumentSequence } from "./documentSequences.mjs";

const JOB_STATUSES = new Set(["planned", "in_progress", "paused", "change_pending", "closed"]);
const TASK_STATUSES = new Set(["pending", "in_progress", "blocked", "completed"]);

export function createPostgresJobRepositoryFromEnv(env = process.env) {
  const pool = createPostgresPoolFromEnv(env);
  if (!pool) {
    return null;
  }

  return {
    ...createPostgresJobRepository(pool),
    async close() {
      await pool.end();
    },
  };
}

export function createPostgresJobRepository(pool) {
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

  async function listJobs(context, filters = {}) {
    return queryForTenant(context, async (client) => {
      const params = [context.tenant.tenantId];
      const where = ["j.tenant_id = $1"];
      if (filters.status && JOB_STATUSES.has(filters.status)) {
        params.push(filters.status);
        where.push(`j.status = $${params.length}`);
      } else {
        where.push("j.status <> 'closed'");
      }
      if (filters.search) {
        params.push(`%${String(filters.search).trim().toLowerCase()}%`);
        where.push(`(lower(j.job_number) LIKE $${params.length} OR lower(j.title) LIKE $${params.length} OR lower(c.name) LIKE $${params.length})`);
      }
      const result = await client.query(
        `
          SELECT j.job_id, j.client_id, c.name AS client_name, j.estimate_id, e.estimate_number,
                 j.job_number, j.title, j.status, j.scheduled_start, j.scheduled_end,
                 j.project_address, j.project_latitude, j.project_longitude, j.allowed_radius_meters,
                 j.created_at, j.updated_at,
                 count(t.job_task_id) FILTER (WHERE t.status <> 'completed')::integer AS open_tasks,
                 count(t.job_task_id) FILTER (WHERE t.status = 'completed')::integer AS completed_tasks,
                 count(t.job_task_id)::integer AS total_tasks,
                 CASE
                   WHEN count(t.job_task_id) = 0 THEN 0
                   ELSE round((count(t.job_task_id) FILTER (WHERE t.status = 'completed')::numeric / count(t.job_task_id)::numeric) * 100)::integer
                 END AS progress_percent
          FROM jobs j
          JOIN clients c ON c.tenant_id = j.tenant_id AND c.client_id = j.client_id
          LEFT JOIN estimates e ON e.tenant_id = j.tenant_id AND e.estimate_id = j.estimate_id
          LEFT JOIN job_tasks t ON t.tenant_id = j.tenant_id AND t.job_id = j.job_id
          WHERE ${where.join(" AND ")}
          GROUP BY j.job_id, c.name, e.estimate_number
          ORDER BY j.updated_at DESC, j.created_at DESC
          LIMIT 100
        `,
        params,
      );
      const summary = await client.query(
        `
          SELECT
            count(*) FILTER (WHERE status <> 'closed')::integer AS total,
            count(*) FILTER (WHERE status = 'planned')::integer AS planned,
            count(*) FILTER (WHERE status = 'in_progress')::integer AS in_progress,
            count(*) FILTER (WHERE status = 'change_pending')::integer AS change_pending
          FROM jobs
          WHERE tenant_id = $1
        `,
        [context.tenant.tenantId],
      );
      return { items: result.rows.map(mapJob), total: result.rowCount, summary: summary.rows[0] };
    });
  }

  async function getJob(context, jobId) {
    return queryForTenant(context, async (client) => {
      const result = await client.query(
        `
          SELECT j.job_id, j.client_id, c.name AS client_name, j.estimate_id, e.estimate_number,
                 j.job_number, j.title, j.status, j.scheduled_start, j.scheduled_end,
                 j.project_address, j.project_latitude, j.project_longitude, j.allowed_radius_meters,
                 j.created_at, j.updated_at,
                 count(t.job_task_id) FILTER (WHERE t.status <> 'completed')::integer AS open_tasks,
                 count(t.job_task_id) FILTER (WHERE t.status = 'completed')::integer AS completed_tasks,
                 count(t.job_task_id)::integer AS total_tasks,
                 CASE
                   WHEN count(t.job_task_id) = 0 THEN 0
                   ELSE round((count(t.job_task_id) FILTER (WHERE t.status = 'completed')::numeric / count(t.job_task_id)::numeric) * 100)::integer
                 END AS progress_percent
          FROM jobs j
          JOIN clients c ON c.tenant_id = j.tenant_id AND c.client_id = j.client_id
          LEFT JOIN estimates e ON e.tenant_id = j.tenant_id AND e.estimate_id = j.estimate_id
          LEFT JOIN job_tasks t ON t.tenant_id = j.tenant_id AND t.job_id = j.job_id
          WHERE j.tenant_id = $1 AND j.job_id = $2
          GROUP BY j.job_id, c.name, e.estimate_number
        `,
        [context.tenant.tenantId, jobId],
      );
      if (!result.rows[0]) {
        return null;
      }
      const phases = await client.query(
        `
          SELECT job_phase_id, title, status, sort_order, starts_on, ends_on, created_at, updated_at
          FROM job_phases
          WHERE tenant_id = $1 AND job_id = $2
          ORDER BY sort_order, created_at
        `,
        [context.tenant.tenantId, jobId],
      );
      const tasks = await client.query(
        `
          SELECT t.job_task_id, t.job_phase_id, t.title, t.status, t.assigned_to_worker_id,
                 w.name AS assigned_worker_name, t.due_at, t.created_at, t.updated_at
          FROM job_tasks t
          LEFT JOIN workers w ON w.tenant_id = t.tenant_id AND w.worker_id = t.assigned_to_worker_id
          WHERE t.tenant_id = $1 AND t.job_id = $2
          ORDER BY t.created_at DESC
        `,
        [context.tenant.tenantId, jobId],
      );
      const changes = await client.query(
        `
          SELECT change_request_id, title, description, status, amount_delta, created_at, updated_at
          FROM job_change_requests
          WHERE tenant_id = $1 AND job_id = $2
          ORDER BY created_at DESC
        `,
        [context.tenant.tenantId, jobId],
      );
      const assignments = await client.query(
        `
          SELECT a.assignment_id, a.worker_id, w.name AS worker_name, a.starts_at, a.ends_at, a.status
          FROM assignments a
          JOIN workers w ON w.tenant_id = a.tenant_id AND w.worker_id = a.worker_id
          WHERE a.tenant_id = $1 AND a.job_id = $2 AND a.status <> 'completed'
          ORDER BY a.starts_at DESC NULLS LAST, a.assignment_id DESC
        `,
        [context.tenant.tenantId, jobId],
      );
      return {
        job: mapJob(result.rows[0]),
        phases: phases.rows.map(mapPhase),
        tasks: tasks.rows.map(mapTask),
        assignments: assignments.rows.map(mapAssignment),
        changeRequests: changes.rows.map(mapChangeRequest),
      };
    });
  }

  async function createJob(context, input) {
    const clean = validateJobInput(input);
    return queryForTenant(context, async (client) => {
      await requireClientForTenant(client, context.tenant.tenantId, clean.clientId);
      if (clean.estimateId) {
        await requireEstimateForTenant(client, context.tenant.tenantId, clean.estimateId, clean.clientId);
      }
      const jobNumber = clean.jobNumber || (await generateJobNumber(client, context.tenant.tenantId));
      const result = await client.query(
        `
          INSERT INTO jobs (
            tenant_id, client_id, estimate_id, job_number, title, status, scheduled_start, scheduled_end,
            project_address, project_latitude, project_longitude, allowed_radius_meters
          )
          VALUES ($1, $2, $3, $4, $5, 'planned', $6, $7, $8, $9, $10, $11)
          RETURNING job_id, client_id, estimate_id, job_number, title, status, scheduled_start, scheduled_end,
                    project_address, project_latitude, project_longitude, allowed_radius_meters, created_at, updated_at
        `,
        [
          context.tenant.tenantId,
          clean.clientId,
          clean.estimateId,
          jobNumber,
          clean.title,
          clean.scheduledStart,
          clean.scheduledEnd,
          clean.projectAddress,
          clean.projectLatitude,
          clean.projectLongitude,
          clean.allowedRadiusMeters,
        ],
      );
      await insertDefaultPhases(client, context.tenant.tenantId, result.rows[0].job_id, clean.phases);
      await writeAudit(client, context, "jobs.created", "job", result.rows[0].job_id, { jobNumber, estimateId: clean.estimateId || null });
      return mapJob(result.rows[0]);
    });
  }

  async function updateJob(context, jobId, input) {
    const clean = validateJobUpdateInput(input);
    return queryForTenant(context, async (client) => {
      const existing = await requireJobForTenant(client, context.tenant.tenantId, jobId);
      const result = await client.query(
        `
          UPDATE jobs
          SET title = $3,
              status = $4,
              scheduled_start = $5,
              scheduled_end = $6,
              project_address = $7,
              project_latitude = $8,
              project_longitude = $9,
              allowed_radius_meters = $10,
              updated_at = now()
          WHERE tenant_id = $1 AND job_id = $2
          RETURNING job_id, client_id, estimate_id, job_number, title, status, scheduled_start, scheduled_end,
                    project_address, project_latitude, project_longitude, allowed_radius_meters, created_at, updated_at
        `,
        [
          context.tenant.tenantId,
          jobId,
          clean.title ?? existing.title,
          clean.status ?? existing.status,
          clean.hasScheduledStart ? clean.scheduledStart : existing.scheduled_start,
          clean.hasScheduledEnd ? clean.scheduledEnd : existing.scheduled_end,
          clean.hasProjectAddress ? clean.projectAddress : existing.project_address,
          clean.hasProjectLatitude ? clean.projectLatitude : existing.project_latitude,
          clean.hasProjectLongitude ? clean.projectLongitude : existing.project_longitude,
          clean.hasAllowedRadiusMeters ? clean.allowedRadiusMeters : existing.allowed_radius_meters,
        ],
      );
      await writeAudit(client, context, "jobs.updated", "job", jobId, { fields: Object.keys(input || {}) });
      return mapJob(result.rows[0]);
    });
  }

  async function assignWorkerToJob(context, jobId, input = {}) {
    const workerId = requiredText(input.workerId, 80, "Trabajador requerido.");
    return queryForTenant(context, async (client) => {
      await requireJobForTenant(client, context.tenant.tenantId, jobId);
      const worker = await requireWorkerForTenant(client, context.tenant.tenantId, workerId);
      await ensureAssignmentForWorker(client, context.tenant.tenantId, jobId, workerId);
      const result = await client.query(
        `
          SELECT a.assignment_id, a.worker_id, w.name AS worker_name, a.starts_at, a.ends_at, a.status
          FROM assignments a
          JOIN workers w ON w.tenant_id = a.tenant_id AND w.worker_id = a.worker_id
          WHERE a.tenant_id = $1 AND a.job_id = $2 AND a.worker_id = $3 AND a.status <> 'completed'
          ORDER BY a.starts_at DESC NULLS LAST, a.assignment_id DESC
          LIMIT 1
        `,
        [context.tenant.tenantId, jobId, workerId],
      );
      await writeAudit(client, context, "jobs.worker.assigned", "assignment", result.rows[0].assignment_id, {
        jobId,
        workerId,
        workerName: worker.name,
      });
      return mapAssignment(result.rows[0]);
    });
  }

  async function createTask(context, jobId, input) {
    const clean = validateTaskInput(input);
    return queryForTenant(context, async (client) => {
      await requireJobForTenant(client, context.tenant.tenantId, jobId);
      let assignedWorker = null;
      if (clean.jobPhaseId) {
        await requirePhaseForTenant(client, context.tenant.tenantId, jobId, clean.jobPhaseId);
      }
      if (clean.assignedToWorkerId) {
        assignedWorker = await requireWorkerForTenant(client, context.tenant.tenantId, clean.assignedToWorkerId);
      }
      const result = await client.query(
        `
          INSERT INTO job_tasks (tenant_id, job_id, job_phase_id, title, status, assigned_to_worker_id, due_at, created_by_user_id)
          VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)
          RETURNING job_task_id, job_phase_id, title, status, assigned_to_worker_id, due_at, created_at, updated_at
        `,
        [context.tenant.tenantId, jobId, clean.jobPhaseId, clean.title, clean.assignedToWorkerId, clean.dueAt, context.actor.userId],
      );
      if (clean.assignedToWorkerId) {
        await ensureAssignmentForWorker(client, context.tenant.tenantId, jobId, clean.assignedToWorkerId);
      }
      if (assignedWorker?.user_id) {
        await enqueueTaskAssignmentNotification(client, context.tenant.tenantId, {
          recipientUserId: assignedWorker.user_id,
          taskTitle: result.rows[0].title,
          taskId: result.rows[0].job_task_id,
          action: "created",
        });
      }
      await syncJobPhasesFromTasks(client, context.tenant.tenantId, jobId);
      await writeAudit(client, context, "jobs.task.created", "job_task", result.rows[0].job_task_id, {
        jobId,
        assignedToWorkerId: clean.assignedToWorkerId || null,
      });
      return mapTask(result.rows[0]);
    });
  }

  async function updateTask(context, jobId, taskId, input) {
    const clean = validateTaskUpdateInput(input);
    return queryForTenant(context, async (client) => {
      await requireJobForTenant(client, context.tenant.tenantId, jobId);
      const existing = await requireTaskForTenant(client, context.tenant.tenantId, jobId, taskId);
      const assignedToWorkerId = clean.hasAssignedToWorkerId ? clean.assignedToWorkerId : existing.assigned_to_worker_id;
      let assignedWorker = null;
      if (assignedToWorkerId) {
        assignedWorker = await requireWorkerForTenant(client, context.tenant.tenantId, assignedToWorkerId);
      }
      const result = await client.query(
        `
          UPDATE job_tasks
          SET status = $4,
              assigned_to_worker_id = $5,
              due_at = $6,
              updated_at = now()
          WHERE tenant_id = $1 AND job_id = $2 AND job_task_id = $3
          RETURNING job_task_id, job_phase_id, title, status, assigned_to_worker_id, due_at, created_at, updated_at
        `,
        [
          context.tenant.tenantId,
          jobId,
          taskId,
          clean.status || existing.status,
          assignedToWorkerId,
          clean.hasDueAt ? clean.dueAt : existing.due_at,
        ],
      );
      if (assignedToWorkerId) {
        await ensureAssignmentForWorker(client, context.tenant.tenantId, jobId, assignedToWorkerId);
      }
      if (clean.hasAssignedToWorkerId && assignedWorker?.user_id && assignedToWorkerId !== existing.assigned_to_worker_id) {
        await enqueueTaskAssignmentNotification(client, context.tenant.tenantId, {
          recipientUserId: assignedWorker.user_id,
          taskTitle: result.rows[0].title,
          taskId,
          action: "assigned",
        });
      }
      await syncJobPhasesFromTasks(client, context.tenant.tenantId, jobId);
      await syncJobStatusFromTasks(client, context.tenant.tenantId, jobId);
      await writeAudit(client, context, "jobs.task.updated", "job_task", taskId, {
        jobId,
        status: result.rows[0].status,
        assignedToWorkerId: result.rows[0].assigned_to_worker_id || null,
      });
      return mapTask(result.rows[0]);
    });
  }

  async function listWorkerTasks(context) {
    return queryForTenant(context, async (client) => {
      const worker = await resolveWorkerForActor(client, context);
      const result = await client.query(
        `
          SELECT t.job_task_id, t.job_id, t.job_phase_id, t.title, t.status, t.assigned_to_worker_id,
                 w.name AS assigned_worker_name, t.due_at, t.created_at, t.updated_at,
                 j.job_number, j.title AS job_title, j.status AS job_status,
                 c.name AS client_name, p.title AS phase_title,
                 COALESCE(js.total_tasks, 0)::integer AS job_total_tasks,
                 COALESCE(js.completed_tasks, 0)::integer AS job_completed_tasks,
                 CASE
                   WHEN COALESCE(js.total_tasks, 0) = 0 THEN 0
                   ELSE round((COALESCE(js.completed_tasks, 0)::numeric / js.total_tasks::numeric) * 100)::integer
                 END AS job_progress_percent
          FROM job_tasks t
          JOIN jobs j ON j.tenant_id = t.tenant_id AND j.job_id = t.job_id
          JOIN clients c ON c.tenant_id = j.tenant_id AND c.client_id = j.client_id
          LEFT JOIN job_phases p ON p.tenant_id = t.tenant_id AND p.job_phase_id = t.job_phase_id
          LEFT JOIN workers w ON w.tenant_id = t.tenant_id AND w.worker_id = t.assigned_to_worker_id
          LEFT JOIN (
            SELECT tenant_id, job_id,
                   count(*)::integer AS total_tasks,
                   count(*) FILTER (WHERE status = 'completed')::integer AS completed_tasks
            FROM job_tasks
            WHERE tenant_id = $1
            GROUP BY tenant_id, job_id
          ) js ON js.tenant_id = t.tenant_id AND js.job_id = t.job_id
          WHERE t.tenant_id = $1
            AND t.assigned_to_worker_id = $2
            AND j.status <> 'closed'
          ORDER BY
            CASE t.status
              WHEN 'blocked' THEN 0
              WHEN 'in_progress' THEN 1
              WHEN 'pending' THEN 2
              ELSE 3
            END,
            t.due_at NULLS LAST,
            t.created_at DESC
        `,
        [context.tenant.tenantId, worker.worker_id],
      );
      const summary = {
        total: result.rows.length,
        pending: result.rows.filter((row) => row.status === "pending").length,
        in_progress: result.rows.filter((row) => row.status === "in_progress").length,
        blocked: result.rows.filter((row) => row.status === "blocked").length,
        completed: result.rows.filter((row) => row.status === "completed").length,
      };
      return { worker: mapWorker(worker), items: result.rows.map(mapWorkerTask), total: result.rows.length, summary };
    });
  }

  async function updateWorkerTask(context, taskId, input) {
    const clean = validateWorkerTaskUpdateInput(input);
    return queryForTenant(context, async (client) => {
      const worker = await resolveWorkerForActor(client, context);
      const existing = await client.query(
        `
          SELECT t.job_task_id, t.job_id, t.status, t.title, j.title AS job_title
          FROM job_tasks t
          JOIN jobs j ON j.tenant_id = t.tenant_id AND j.job_id = t.job_id
          WHERE t.tenant_id = $1 AND t.job_task_id = $2 AND t.assigned_to_worker_id = $3
        `,
        [context.tenant.tenantId, taskId, worker.worker_id],
      );
      if (!existing.rows[0]) {
        forbidden("No puedes actualizar una tarea que no esta asignada a tu perfil.");
      }
      const result = await client.query(
        `
          UPDATE job_tasks
          SET status = $4,
              updated_at = now()
          WHERE tenant_id = $1 AND job_task_id = $2 AND assigned_to_worker_id = $3
          RETURNING job_task_id, job_phase_id, title, status, assigned_to_worker_id, due_at, created_at, updated_at
        `,
        [context.tenant.tenantId, taskId, worker.worker_id, clean.status],
      );
      await syncJobPhasesFromTasks(client, context.tenant.tenantId, existing.rows[0].job_id);
      await syncJobStatusFromTasks(client, context.tenant.tenantId, existing.rows[0].job_id);
      await writeAudit(client, context, clean.status === "completed" ? "worker.task.completed" : clean.status === "blocked" ? "worker.task.blocked" : "worker.task.updated", "job_task", taskId, {
        jobId: existing.rows[0].job_id,
        workerId: worker.worker_id,
        status: clean.status,
        reportNote: clean.reportNote || null,
      });
      if (clean.status !== existing.rows[0].status) {
        await enqueueJobNotification(client, context.tenant.tenantId, {
          status: clean.status,
          workerName: worker.name,
          taskTitle: existing.rows[0].title,
          jobTitle: existing.rows[0].job_title,
          taskId,
          reportNote: clean.reportNote || "",
        });
      }
      return mapTask(result.rows[0]);
    });
  }

  async function createChangeRequest(context, jobId, input) {
    const clean = validateChangeRequestInput(input);
    return queryForTenant(context, async (client) => {
      await requireJobForTenant(client, context.tenant.tenantId, jobId);
      const result = await client.query(
        `
          INSERT INTO job_change_requests (tenant_id, job_id, title, description, status, amount_delta, requested_by_user_id)
          VALUES ($1, $2, $3, $4, 'draft', $5, $6)
          RETURNING change_request_id, title, description, status, amount_delta, created_at, updated_at
        `,
        [context.tenant.tenantId, jobId, clean.title, clean.description, clean.amountDelta, context.actor.userId],
      );
      await client.query("UPDATE jobs SET status = 'change_pending', updated_at = now() WHERE tenant_id = $1 AND job_id = $2", [context.tenant.tenantId, jobId]);
      await writeAudit(client, context, "jobs.change_request.created", "job_change_request", result.rows[0].change_request_id, { jobId, amountDelta: clean.amountDelta });
      return mapChangeRequest(result.rows[0]);
    });
  }

  return {
    listJobs,
    getJob,
    createJob,
    updateJob,
    assignWorkerToJob,
    createTask,
    updateTask,
    listWorkerTasks,
    updateWorkerTask,
    createChangeRequest,
  };
}

async function requireClientForTenant(client, tenantId, clientId) {
  const result = await client.query("SELECT client_id FROM clients WHERE tenant_id = $1 AND client_id = $2 AND status <> 'archived'", [tenantId, clientId]);
  if (!result.rows[0]) {
    notFound("Cliente no encontrado para esta empresa.");
  }
}

async function requireEstimateForTenant(client, tenantId, estimateId, clientId) {
  const result = await client.query("SELECT estimate_id FROM estimates WHERE tenant_id = $1 AND estimate_id = $2 AND client_id = $3", [tenantId, estimateId, clientId]);
  if (!result.rows[0]) {
    notFound("Cotizacion no encontrada para este cliente y empresa.");
  }
}

async function requireJobForTenant(client, tenantId, jobId) {
  const result = await client.query("SELECT * FROM jobs WHERE tenant_id = $1 AND job_id = $2", [tenantId, jobId]);
  if (!result.rows[0]) {
    notFound("Obra no encontrada para esta empresa.");
  }
  return result.rows[0];
}

async function requirePhaseForTenant(client, tenantId, jobId, phaseId) {
  const result = await client.query("SELECT job_phase_id FROM job_phases WHERE tenant_id = $1 AND job_id = $2 AND job_phase_id = $3", [tenantId, jobId, phaseId]);
  if (!result.rows[0]) {
    notFound("Fase no encontrada para esta obra.");
  }
}

async function requireTaskForTenant(client, tenantId, jobId, taskId) {
  const result = await client.query(
    "SELECT job_task_id, status, assigned_to_worker_id, due_at FROM job_tasks WHERE tenant_id = $1 AND job_id = $2 AND job_task_id = $3",
    [tenantId, jobId, taskId],
  );
  if (!result.rows[0]) {
    notFound("Tarea no encontrada para esta obra.");
  }
  return result.rows[0];
}

async function requireWorkerForTenant(client, tenantId, workerId) {
  const result = await client.query("SELECT worker_id, user_id, name, status FROM workers WHERE tenant_id = $1 AND worker_id = $2 AND status = 'active'", [tenantId, workerId]);
  if (!result.rows[0]) {
    notFound("Trabajador activo no encontrado para esta empresa.");
  }
  return result.rows[0];
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

async function ensureAssignmentForWorker(client, tenantId, jobId, workerId) {
  const existing = await client.query(
    "SELECT assignment_id FROM assignments WHERE tenant_id = $1 AND job_id = $2 AND worker_id = $3 AND status <> 'completed' LIMIT 1",
    [tenantId, jobId, workerId],
  );
  if (existing.rows[0]) {
    await client.query("UPDATE assignments SET status = 'assigned' WHERE tenant_id = $1 AND assignment_id = $2", [tenantId, existing.rows[0].assignment_id]);
    return;
  }
  await client.query(
    "INSERT INTO assignments (tenant_id, job_id, worker_id, starts_at, status) VALUES ($1, $2, $3, now(), 'assigned')",
    [tenantId, jobId, workerId],
  );
}

async function syncJobStatusFromTasks(client, tenantId, jobId) {
  const result = await client.query(
    `
      SELECT
        count(*)::integer AS total,
        count(*) FILTER (WHERE status = 'completed')::integer AS completed,
        count(*) FILTER (WHERE status IN ('in_progress', 'blocked'))::integer AS active
      FROM job_tasks
      WHERE tenant_id = $1 AND job_id = $2
    `,
    [tenantId, jobId],
  );
  const phaseResult = await client.query(
    `
      SELECT count(*)::integer AS total,
             count(*) FILTER (WHERE status = 'completed')::integer AS completed
      FROM job_phases
      WHERE tenant_id = $1 AND job_id = $2
    `,
    [tenantId, jobId],
  );
  const row = result.rows[0] || {};
  const phases = phaseResult.rows[0] || {};
  const allPhasesCompleted = phases.total > 0 && phases.completed === phases.total;
  const nextStatus =
    row.total > 0 && row.completed === row.total && allPhasesCompleted
      ? "closed"
      : row.active > 0 || row.completed > 0
        ? "in_progress"
        : null;
  if (nextStatus) {
    await client.query("UPDATE jobs SET status = $3, updated_at = now() WHERE tenant_id = $1 AND job_id = $2 AND status <> 'change_pending'", [tenantId, jobId, nextStatus]);
  }
}

async function syncJobPhasesFromTasks(client, tenantId, jobId) {
  const result = await client.query(
    `
      SELECT p.job_phase_id,
             p.sort_order,
             count(t.job_task_id)::integer AS total_tasks,
             count(t.job_task_id) FILTER (WHERE t.status = 'completed')::integer AS completed_tasks
      FROM job_phases p
      LEFT JOIN job_tasks t ON t.tenant_id = p.tenant_id AND t.job_phase_id = p.job_phase_id
      WHERE p.tenant_id = $1 AND p.job_id = $2
      GROUP BY p.job_phase_id, p.sort_order
      ORDER BY p.sort_order, p.job_phase_id
    `,
    [tenantId, jobId],
  );
  if (result.rows.length === 0) {
    return;
  }
  const firstOpen = result.rows.find((row) => row.total_tasks === 0 || row.completed_tasks < row.total_tasks);
  for (const row of result.rows) {
    const nextStatus =
      row.total_tasks > 0 && row.completed_tasks === row.total_tasks
        ? "completed"
        : firstOpen?.job_phase_id === row.job_phase_id
          ? "active"
          : "pending";
    await client.query(
      `
        UPDATE job_phases
        SET status = $3,
            updated_at = now()
        WHERE tenant_id = $1 AND job_phase_id = $2 AND status <> $3
      `,
      [tenantId, row.job_phase_id, nextStatus],
    );
  }
}

async function generateJobNumber(client, tenantId) {
  const value = await nextDocumentSequence(client, { tenantId, documentType: "job", series: "JOB" });
  return `JOB-${String(value).padStart(5, "0")}`;
}

async function insertDefaultPhases(client, tenantId, jobId, phases) {
  const titles = phases.length > 0 ? phases : ["Preparacion", "Ejecucion", "Entrega"];
  for (const [index, title] of titles.entries()) {
    await client.query(
      "INSERT INTO job_phases (tenant_id, job_id, title, status, sort_order) VALUES ($1, $2, $3, $4, $5)",
      [tenantId, jobId, title, index === 0 ? "active" : "pending", index],
    );
  }
}

function validateJobInput(input) {
  const clean = {
    clientId: requiredText(input?.clientId, 80, "Cliente requerido."),
    estimateId: nullableText(input?.estimateId, 80),
    jobNumber: nullableText(input?.jobNumber, 40),
    title: requiredText(input?.title, 180, "Titulo de obra requerido."),
    scheduledStart: nullableDate(input?.scheduledStart),
    scheduledEnd: nullableDate(input?.scheduledEnd),
    projectAddress: nullableText(input?.projectAddress, 240),
    projectLatitude: nullableCoordinate(input?.projectLatitude, -90, 90),
    projectLongitude: nullableCoordinate(input?.projectLongitude, -180, 180),
    allowedRadiusMeters: clampNumber(input?.allowedRadiusMeters, 25, 5000, 250),
    phases: Array.isArray(input?.phases) ? input.phases.slice(0, 8).map((phase) => requiredText(phase, 100, "Fase no valida.")) : [],
  };
  validateCoordinatePair(clean.projectLatitude, clean.projectLongitude);
  return clean;
}

function validateJobUpdateInput(input = {}) {
  const hasScheduledStart = Object.prototype.hasOwnProperty.call(input, "scheduledStart");
  const hasScheduledEnd = Object.prototype.hasOwnProperty.call(input, "scheduledEnd");
  const hasProjectAddress = Object.prototype.hasOwnProperty.call(input, "projectAddress");
  const hasProjectLatitude = Object.prototype.hasOwnProperty.call(input, "projectLatitude");
  const hasProjectLongitude = Object.prototype.hasOwnProperty.call(input, "projectLongitude");
  const hasAllowedRadiusMeters = Object.prototype.hasOwnProperty.call(input, "allowedRadiusMeters");
  const status = input.status === undefined ? null : String(input.status);
  if (status && !JOB_STATUSES.has(status)) {
    validationError("Estado de obra no valido.");
  }
  const clean = {
    title: input.title === undefined ? null : requiredText(input.title, 180, "Titulo de obra requerido."),
    status,
    scheduledStart: hasScheduledStart ? nullableDate(input.scheduledStart) : null,
    scheduledEnd: hasScheduledEnd ? nullableDate(input.scheduledEnd) : null,
    projectAddress: hasProjectAddress ? nullableText(input.projectAddress, 240) : null,
    projectLatitude: hasProjectLatitude ? nullableCoordinate(input.projectLatitude, -90, 90) : null,
    projectLongitude: hasProjectLongitude ? nullableCoordinate(input.projectLongitude, -180, 180) : null,
    allowedRadiusMeters: hasAllowedRadiusMeters ? clampNumber(input.allowedRadiusMeters, 25, 5000, 250) : null,
    hasScheduledStart,
    hasScheduledEnd,
    hasProjectAddress,
    hasProjectLatitude,
    hasProjectLongitude,
    hasAllowedRadiusMeters,
  };
  if (hasProjectLatitude !== hasProjectLongitude) {
    validationError("Latitud y longitud deben guardarse juntas.");
  }
  validateCoordinatePair(clean.projectLatitude, clean.projectLongitude);
  return clean;
}

function validateTaskInput(input) {
  return {
    jobPhaseId: nullableText(input?.jobPhaseId, 80),
    title: requiredText(input?.title, 180, "Titulo de tarea requerido."),
    status: input?.status && TASK_STATUSES.has(input.status) ? input.status : "pending",
    assignedToWorkerId: nullableText(input?.assignedToWorkerId, 80),
    dueAt: nullableIso(input?.dueAt),
  };
}

function validateTaskUpdateInput(input) {
  const hasAssignedToWorkerId = Object.prototype.hasOwnProperty.call(input || {}, "assignedToWorkerId");
  const hasDueAt = Object.prototype.hasOwnProperty.call(input || {}, "dueAt");
  return {
    status: input?.status && TASK_STATUSES.has(input.status) ? input.status : null,
    assignedToWorkerId: hasAssignedToWorkerId ? nullableText(input?.assignedToWorkerId, 80) : null,
    hasAssignedToWorkerId,
    dueAt: hasDueAt ? nullableIso(input?.dueAt) : null,
    hasDueAt,
  };
}

function validateWorkerTaskUpdateInput(input) {
  const status = String(input?.status || "").trim();
  if (!["pending", "in_progress", "blocked", "completed"].includes(status)) {
    validationError("Estado de tarea no valido.");
  }
  return { status, reportNote: nullableText(input?.reportNote, 1000) || "" };
}

function validateCoordinatePair(latitude, longitude) {
  const hasLatitude = latitude !== null && latitude !== undefined;
  const hasLongitude = longitude !== null && longitude !== undefined;
  if (hasLatitude !== hasLongitude) {
    validationError("Configura latitud y longitud juntas para activar el control GPS de la obra.");
  }
}

function validateChangeRequestInput(input) {
  return {
    title: requiredText(input?.title, 180, "Titulo de cambio requerido."),
    description: nullableText(input?.description, 1000) || "",
    amountDelta: clampNumber(input?.amountDelta, -1_000_000_000, 1_000_000_000, 0),
  };
}

async function writeAudit(client, context, action, entityType, entityId, metadata) {
  await client.query(
    `
      INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, $2, $3, 'jobs', $4, $5, 'info', $6::jsonb)
    `,
    [context.tenant.tenantId, context.actor.userId, action, entityType, entityId, JSON.stringify(metadata || {})],
  );
}

async function enqueueJobNotification(client, tenantId, input) {
  const label = taskStatusNotificationLabel(input.status);
  const severity = input.status === "blocked" ? "warning" : input.status === "completed" ? "success" : "info";
  const title = input.status === "blocked" ? "Tarea bloqueada" : input.status === "completed" ? "Tarea completada" : "Tarea actualizada";
  const eventKey = input.status === "completed" ? "worker.task.completed" : input.status === "blocked" ? "worker.task.blocked" : "worker.task.updated";
  const message = input.reportNote
    ? `${input.workerName} reporto "${input.taskTitle}" como ${label} en ${input.jobTitle}: ${input.reportNote}`
    : `${input.workerName} marco "${input.taskTitle}" como ${label} en ${input.jobTitle}.`;
  for (const audienceRole of ["manager", "admin"]) {
    await client.query(
      `
        INSERT INTO notification_queue (tenant_id, audience_role, channel, event_key, title, message, severity, related_entity_type, related_entity_id)
        VALUES ($1, $2, 'in_app', $3, $4, $5, $6, 'job_task', $7)
      `,
      [tenantId, audienceRole, eventKey, title, message, severity, input.taskId],
    );
  }
}

async function enqueueTaskAssignmentNotification(client, tenantId, input) {
  await client.query(
    `
      INSERT INTO notification_queue (tenant_id, recipient_user_id, audience_role, channel, event_key, title, message, severity, related_entity_type, related_entity_id)
      VALUES ($1, $2, 'worker', 'in_app', $3, $4, $5, 'info', 'job_task', $6)
    `,
    [
      tenantId,
      input.recipientUserId,
      "jobs.task.assigned",
      input.action === "created" ? "Nueva tarea asignada" : "Tarea reasignada",
      `Se te asigno la tarea "${input.taskTitle}".`,
      input.taskId,
    ],
  );
}

function taskStatusNotificationLabel(status) {
  return {
    pending: "pendiente",
    in_progress: "en progreso",
    blocked: "bloqueada",
    completed: "completada",
  }[status] || status;
}

function mapJob(row) {
  return {
    jobId: row.job_id,
    clientId: row.client_id,
    clientName: row.client_name || "",
    estimateId: row.estimate_id || null,
    estimateNumber: row.estimate_number || "",
    jobNumber: row.job_number,
    title: row.title,
    status: row.status,
    scheduledStart: row.scheduled_start?.toISOString?.().slice(0, 10) || row.scheduled_start || "",
    scheduledEnd: row.scheduled_end?.toISOString?.().slice(0, 10) || row.scheduled_end || "",
    projectAddress: row.project_address || "",
    projectLatitude: row.project_latitude === null || row.project_latitude === undefined ? null : Number(row.project_latitude),
    projectLongitude: row.project_longitude === null || row.project_longitude === undefined ? null : Number(row.project_longitude),
    allowedRadiusMeters: Number(row.allowed_radius_meters || 250),
    openTasks: row.open_tasks || 0,
    completedTasks: row.completed_tasks || 0,
    totalTasks: row.total_tasks || 0,
    progressPercent: row.progress_percent || 0,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function mapPhase(row) {
  return {
    phaseId: row.job_phase_id,
    title: row.title,
    status: row.status,
    sortOrder: row.sort_order,
    startsOn: row.starts_on?.toISOString?.().slice(0, 10) || row.starts_on || "",
    endsOn: row.ends_on?.toISOString?.().slice(0, 10) || row.ends_on || "",
  };
}

function mapTask(row) {
  return {
    taskId: row.job_task_id,
    phaseId: row.job_phase_id || null,
    title: row.title,
    status: row.status,
    assignedToWorkerId: row.assigned_to_worker_id || null,
    assignedWorkerName: row.assigned_worker_name || "",
    dueAt: row.due_at?.toISOString?.() || row.due_at || "",
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

function mapAssignment(row) {
  return {
    assignmentId: row.assignment_id,
    workerId: row.worker_id,
    workerName: row.worker_name || "",
    startsAt: row.starts_at?.toISOString?.() || row.starts_at || "",
    endsAt: row.ends_at?.toISOString?.() || row.ends_at || "",
    status: row.status || "assigned",
    createdAt: row.starts_at?.toISOString?.() || row.starts_at || "",
    updatedAt: row.ends_at?.toISOString?.() || row.ends_at || "",
  };
}

function mapWorkerTask(row) {
  return {
    ...mapTask(row),
    jobId: row.job_id,
    jobNumber: row.job_number,
    jobTitle: row.job_title,
    jobStatus: row.job_status,
    clientName: row.client_name,
    phaseTitle: row.phase_title || "",
    jobTotalTasks: Number(row.job_total_tasks || 0),
    jobCompletedTasks: Number(row.job_completed_tasks || 0),
    jobProgressPercent: Number(row.job_progress_percent || 0),
  };
}

function mapChangeRequest(row) {
  return {
    changeRequestId: row.change_request_id,
    title: row.title,
    description: row.description || "",
    status: row.status,
    amountDelta: Number(row.amount_delta || 0),
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function requiredText(value, maxLength, message) {
  const text = String(value || "").trim();
  if (text.length < 1 || text.length > maxLength) {
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

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function nullableCoordinate(value, min, max) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    validationError("Coordenada de obra no valida.");
  }
  return number;
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
