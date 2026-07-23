import { BriefcaseBusiness, CheckCircle2, ClipboardList, Edit3, MapPin, Plus, RefreshCw, Save, UserPlus } from "lucide-react";
import type { FormEvent } from "react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { AuthenticatedSession } from "../../../app/auth/authClient";
import { Button } from "../../../shared/components/Button";
import { BasicModal } from "../../../shared/components/BasicModal";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { listCrmClients, type CrmClient } from "../../crm/api/crmClient";
import { listEstimates, type EstimateSummary } from "../../estimates/api/estimateClient";
import {
  assignWorkerToJob,
  createJob,
  createJobChangeRequest,
  createJobTask,
  getJob,
  listJobs,
  type JobDetailResponse,
  type JobInput,
  type JobStatus,
  type JobSummary,
  type JobTask,
  updateJob,
  updateJobTask,
} from "../api/jobClient";
import { listWorkers, type WorkerSummary } from "../../workforce/api/workforceClient";
import { capturePointInTimeLocation } from "../../../app/native/nativeCapabilities";

type JobsRealPageProps = {
  session: AuthenticatedSession;
};

const statusLabels: Record<JobStatus, string> = {
  planned: "Planificada",
  in_progress: "En progreso",
  paused: "En pausa",
  change_pending: "Cambio pendiente",
  closed: "Cerrada",
};

const statusTone: Record<JobStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  planned: "neutral",
  in_progress: "success",
  paused: "warning",
  change_pending: "danger",
  closed: "info",
};

const taskStatusLabels: Record<JobTask["status"], string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  blocked: "Bloqueada",
  completed: "Completada",
};

const initialJobForm: JobInput = {
  clientId: "",
  estimateId: "",
  title: "",
  scheduledStart: "",
  scheduledEnd: "",
  projectAddress: "",
  projectLatitude: null,
  projectLongitude: null,
  allowedRadiusMeters: 250,
  phases: ["Preparacion", "Ejecucion", "Entrega"],
};

type JobActionPanel = "create" | "edit" | "assign" | "task" | "change" | null;

export function JobsRealPage({ session }: JobsRealPageProps) {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [estimates, setEstimates] = useState<EstimateSummary[]>([]);
  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [detail, setDetail] = useState<JobDetailResponse | null>(null);
  const [form, setForm] = useState<JobInput>(initialJobForm);
  const [editForm, setEditForm] = useState<Partial<JobInput> & { status?: JobStatus }>({});
  const [activePanel, setActivePanel] = useState<JobActionPanel>(null);
  const [assignmentWorkerId, setAssignmentWorkerId] = useState("");
  const [taskForm, setTaskForm] = useState({ title: "", phaseId: "", assignedToWorkerId: "", dueAt: "" });
  const [changeTitle, setChangeTitle] = useState("");
  const [changeAmount, setChangeAmount] = useState(0);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const approvedEstimates = useMemo(() => {
    return estimates.filter((estimate) => estimate.status === "approved" && (!form.clientId || estimate.clientId === form.clientId));
  }, [estimates, form.clientId]);
  const assignedWorkerIds = useMemo(() => new Set((detail?.assignments || []).map((assignment) => assignment.workerId)), [detail?.assignments]);
  const assignableWorkers = useMemo(() => workers.filter((worker) => !assignedWorkerIds.has(worker.workerId)), [assignedWorkerIds, workers]);
  const jobTeamWorkers = useMemo(() => {
    const ids = new Set((detail?.assignments || []).map((assignment) => assignment.workerId));
    return workers.filter((worker) => ids.has(worker.workerId));
  }, [detail?.assignments, workers]);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(nextJobId?: string | null, options: { preserveMessage?: boolean } = {}) {
    setLoading(true);
    if (!options.preserveMessage) {
      setMessage(null);
    }
    try {
      const [jobResult, clientResult, estimateResult] = await Promise.all([
        listJobs(session.sessionToken),
        listCrmClients(session.sessionToken),
        listEstimates(session.sessionToken),
      ]);
      const workerResult = await listWorkers(session.sessionToken).catch(() => ({ items: [] as WorkerSummary[], summary: {} }));
      setJobs(jobResult.items);
      setSummary(jobResult.summary || {});
      setClients(clientResult.items);
      setEstimates(estimateResult.items);
      setWorkers(workerResult.items.filter((worker) => worker.status === "active"));
      if (nextJobId !== undefined) {
        setSelectedJobId(nextJobId);
        if (nextJobId) {
          const nextDetail = await getJob(session.sessionToken, nextJobId);
          setDetail(nextDetail);
          setEditForm(jobToEditForm(nextDetail.job));
        } else {
          setDetail(null);
          setEditForm({});
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar obras.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(jobId: string) {
    if (selectedJobId === jobId && detail) {
      setSelectedJobId(null);
      setDetail(null);
      setActivePanel(null);
      return;
    }
    setSelectedJobId(jobId);
    setActivePanel(null);
    setMessage(null);
    try {
      const nextDetail = await getJob(session.sessionToken, jobId);
      setDetail(nextDetail);
      setEditForm(jobToEditForm(nextDetail.job));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la obra.");
    }
  }

  async function handleCreateJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const created = await createJob(session.sessionToken, {
        ...form,
        estimateId: form.estimateId || null,
        phases: form.phases?.filter(Boolean),
      });
      setForm(initialJobForm);
      setActivePanel(null);
      setMessage("Obra creada con fases iniciales y auditoria.");
      dispatchDataChanged("jobs");
      await refresh(created.jobId, { preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear la obra.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJobId) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateJob(session.sessionToken, selectedJobId, editForm);
      setMessage("Obra actualizada con auditoria.");
      setActivePanel(null);
      dispatchDataChanged("jobs");
      await refresh(selectedJobId, { preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la obra.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAssignWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJobId || !assignmentWorkerId) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await assignWorkerToJob(session.sessionToken, selectedJobId, assignmentWorkerId);
      setAssignmentWorkerId("");
      setActivePanel(null);
      setMessage("Trabajador asignado a la obra. Solo vera tareas que se le asignen.");
      dispatchDataChanged("jobs");
      await refresh(selectedJobId, { preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo asignar trabajador.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJobId) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await createJobTask(session.sessionToken, selectedJobId, {
        title: taskForm.title,
        jobPhaseId: taskForm.phaseId || detail?.phases[0]?.phaseId || null,
        assignedToWorkerId: taskForm.assignedToWorkerId || null,
        dueAt: taskForm.dueAt || undefined,
      });
      setTaskForm({ title: "", phaseId: "", assignedToWorkerId: "", dueAt: "" });
      setActivePanel(null);
      setMessage("Tarea creada y auditada.");
      dispatchDataChanged("jobs");
      await refresh(selectedJobId, { preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear la tarea.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTaskUpdate(taskId: string, input: { status?: JobTask["status"]; assignedToWorkerId?: string | null }) {
    if (!selectedJobId) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateJobTask(session.sessionToken, selectedJobId, taskId, input);
      setMessage("Tarea actualizada y progreso recalculado.");
      dispatchDataChanged("jobs");
      await refresh(selectedJobId, { preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la tarea.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedJobId) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await createJobChangeRequest(session.sessionToken, selectedJobId, {
        title: changeTitle,
        amountDelta: changeAmount,
      });
      setChangeTitle("");
      setChangeAmount(0);
      setActivePanel(null);
      setMessage("Cambio registrado; la obra queda en cambio pendiente.");
      dispatchDataChanged("jobs");
      await refresh(selectedJobId, { preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar el cambio.");
    } finally {
      setSaving(false);
    }
  }

  async function useCurrentLocation(target: "create" | "edit") {
    setSaving(true);
    setMessage(null);
    try {
      const location = await capturePointInTimeLocation();
      if (!location) {
        setMessage("No se pudo obtener la ubicacion. Revisa permisos del navegador o dispositivo.");
        return;
      }
      if (target === "create") {
        setForm((current) => ({
          ...current,
          projectLatitude: Number(location.lat.toFixed(7)),
          projectLongitude: Number(location.lng.toFixed(7)),
        }));
      } else {
        setEditForm((current) => ({
          ...current,
          projectLatitude: Number(location.lat.toFixed(7)),
          projectLongitude: Number(location.lng.toFixed(7)),
        }));
      }
      setMessage("Ubicacion GPS cargada. Ajusta el radio antes de guardar si es necesario.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo capturar la ubicacion.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="production-module-content">
      <PageHeader
        eyebrow="Obras reales"
        title="Trabajos / Obras"
        description="Creacion de obras desde clientes reales, con cotizacion opcional, fases, tareas, cambios y auditoria por tenant."
        actions={
          <div className="segmented-actions">
            <Button variant="primary" type="button" icon={<Plus size={16} />} onClick={() => setActivePanel(activePanel === "create" ? null : "create")}>
              Crear obra
            </Button>
            <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>
              Actualizar
            </Button>
          </div>
        }
      />

      {message ? <p className="login-notice">{message}</p> : null}

      <section className="grid stats-grid crm-real-stats">
        <SummaryCard label="Obras activas" value={loading && jobs.length === 0 ? "Cargando" : summary.total || 0} icon={<BriefcaseBusiness size={20} />} />
        <SummaryCard label="Planificadas" value={loading && jobs.length === 0 ? "Cargando" : summary.planned || 0} icon={<ClipboardList size={20} />} />
        <SummaryCard label="En progreso" value={loading && jobs.length === 0 ? "Cargando" : summary.in_progress || 0} icon={<CheckCircle2 size={20} />} />
        <SummaryCard label="Cambios" value={loading && jobs.length === 0 ? "Cargando" : summary.change_pending || 0} icon={<Plus size={20} />} />
      </section>

      <BasicModal title="Crear obra" open={activePanel === "create"} onClose={() => setActivePanel(null)} size="wide" footer={null}>
        <section>
          <div className="card-title-row">
            <span className="activity-meta">La obra se crea desde cliente real y queda lista para fases, tareas y asignaciones.</span>
            <StatusBadge label="Nueva" tone="success" />
          </div>
          {clients.length === 0 ? <p className="login-security-note">Primero crea un cliente en CRM.</p> : null}
          <form className="auth-form" onSubmit={handleCreateJob}>
            <label className="form-control">
              <span>Cliente</span>
              <select className="select" value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value, estimateId: "" })} required>
                <option value="">Seleccionar cliente</option>
                {clients.map((client) => (
                  <option value={client.clientId} key={client.clientId}>{client.name}</option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span>Cotizacion aprobada opcional</span>
              <select className="select" value={form.estimateId || ""} onChange={(event) => setForm({ ...form, estimateId: event.target.value })}>
                <option value="">Sin cotizacion</option>
                {approvedEstimates.map((estimate) => (
                  <option value={estimate.estimateId} key={estimate.estimateId}>{estimate.estimateNumber} - {estimate.title}</option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span>Titulo</span>
              <input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            </label>
            <label className="form-control">
              <span>Direccion de obra</span>
              <input className="input" value={form.projectAddress || ""} onChange={(event) => setForm({ ...form, projectAddress: event.target.value })} />
            </label>
            <div className="card-title-row">
              <span className="activity-meta">Control GPS para asistencia: coordenadas + radio permitido.</span>
              <StatusBadge label={form.projectLatitude && form.projectLongitude ? "GPS completo" : "Falta GPS"} tone={form.projectLatitude && form.projectLongitude ? "success" : "warning"} />
            </div>
            <div className="grid proof-grid">
              <label className="form-control">
                <span>Latitud GPS</span>
                <input className="input" type="number" step="0.000001" value={form.projectLatitude ?? ""} onChange={(event) => setForm({ ...form, projectLatitude: event.target.value ? Number(event.target.value) : null })} />
              </label>
              <label className="form-control">
                <span>Longitud GPS</span>
                <input className="input" type="number" step="0.000001" value={form.projectLongitude ?? ""} onChange={(event) => setForm({ ...form, projectLongitude: event.target.value ? Number(event.target.value) : null })} />
              </label>
              <label className="form-control">
                <span>Radio permitido para asistencia (m)</span>
                <input className="input" type="number" min="25" max="5000" value={form.allowedRadiusMeters || 250} onChange={(event) => setForm({ ...form, allowedRadiusMeters: Number(event.target.value) })} />
              </label>
              <div className="form-control">
                <span>Ubicacion actual</span>
                <Button variant="secondary" type="button" icon={<MapPin size={16} />} onClick={() => void useCurrentLocation("create")} disabled={saving}>
                  Usar mi ubicacion
                </Button>
              </div>
              <label className="form-control">
                <span>Inicio</span>
                <input className="input" type="date" value={form.scheduledStart || ""} onChange={(event) => setForm({ ...form, scheduledStart: event.target.value })} />
              </label>
              <label className="form-control">
                <span>Fin estimado</span>
                <input className="input" type="date" value={form.scheduledEnd || ""} onChange={(event) => setForm({ ...form, scheduledEnd: event.target.value })} />
              </label>
            </div>
            <Button variant="primary" type="submit" icon={<Save size={16} />} disabled={saving || clients.length === 0}>
              Crear obra
            </Button>
          </form>
        </section>
      </BasicModal>

      <section className="grid crm-real-grid">
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Listado</h2>
            <StatusBadge label={loading ? "Cargando" : `${jobs.length} registros`} tone="info" />
          </div>
          {!loading && jobs.length === 0 ? (
            <EmptyState title="Sin obras todavia" description="Crea la primera obra desde un cliente real. No se cargan datos de ejemplo." />
          ) : (
            <div className="crm-client-list">
              {jobs.map((job) => (
                <article className="activity-item crm-client-row" key={job.jobId}>
                  <span className="activity-icon"><BriefcaseBusiness size={18} /></span>
                  <button className="crm-client-button" type="button" onClick={() => void loadDetail(job.jobId)}>
                    <strong>{job.jobNumber} - {job.title}</strong>
                    <span>
                      {job.clientName || "Cliente sin nombre"} · avance {job.progressPercent}% · {job.completedTasks}/{job.totalTasks} completadas
                    </span>
                  </button>
                  <div className="crm-client-actions">
                    <StatusBadge label={statusLabels[job.status] || job.status} tone={statusTone[job.status] || "neutral"} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {detail ? (
        <section className="grid two-column crm-real-grid" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-title-row">
              <div>
                <h2 className="card-title">{detail.job.jobNumber} - {detail.job.title}</h2>
                <p className="activity-meta">{detail.job.clientName} {detail.job.estimateNumber ? `· ${detail.job.estimateNumber}` : ""}</p>
              </div>
              <div className="segmented-actions">
                <Button variant="secondary" type="button" icon={<Edit3 size={16} />} onClick={() => setActivePanel(activePanel === "edit" ? null : "edit")}>Editar</Button>
                <Button variant="secondary" type="button" icon={<UserPlus size={16} />} onClick={() => setActivePanel(activePanel === "assign" ? null : "assign")}>Trabajador</Button>
                <Button variant="secondary" type="button" icon={<Plus size={16} />} onClick={() => setActivePanel(activePanel === "task" ? null : "task")}>Tarea</Button>
                <StatusBadge label={statusLabels[detail.job.status] || detail.job.status} tone={statusTone[detail.job.status] || "neutral"} />
              </div>
            </div>
            <div className="progress-track" aria-label={`Avance ${detail.job.progressPercent}%`}>
              <span style={{ width: `${detail.job.progressPercent}%` }} />
            </div>
            <p className="activity-meta">
              Avance real: {detail.job.progressPercent}% · {detail.job.completedTasks}/{detail.job.totalTasks} tareas completadas · {detail.job.openTasks} abiertas
            </p>
              {detail.job.projectAddress || detail.job.projectLatitude ? (
                <p className="login-security-note">
                  Ubicacion de control: {detail.job.projectAddress || "Sin direccion"} · radio {detail.job.allowedRadiusMeters || 250} m
                </p>
              ) : null}
            <div className="job-phase-grid">
              {(detail?.phases || []).map((phase) => (
                <article className="job-phase-card" key={phase.phaseId}>
                  <h3 className="alert-title">{phase.title}</h3>
                  <StatusBadge label={phase.status} tone={phase.status === "active" ? "info" : phase.status === "completed" ? "success" : "neutral"} />
                </article>
              ))}
            </div>
            <div className="job-phase-grid" style={{ marginTop: 12 }}>
              <SummaryCard label="Tareas listas" value={detail.job.completedTasks} icon={<CheckCircle2 size={18} />} />
              <SummaryCard label="Abiertas" value={detail.job.openTasks} icon={<ClipboardList size={18} />} />
              <SummaryCard label="En checklist" value={detail.tasks.filter((task) => task.assignedToWorkerId).length} icon={<UserPlus size={18} />} />
            </div>
            <div className="responsive-table" style={{ marginTop: 16 }}>
              <div className="table-header task-row-grid">
                <span>Tarea</span>
                <span>Estado</span>
                <span>Trabajador</span>
                <span>Revision</span>
              </div>
              {detail.tasks.length === 0 ? <p className="activity-meta">Todavia no hay tareas asignadas. Usa el boton Tarea para crear el checklist de esta obra.</p> : null}
              {detail.tasks.map((task) => (
                <article className="table-row task-row-grid" key={task.taskId}>
                  <div>
                    <strong>{task.title}</strong>
                    <span className="activity-meta">{task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "Sin fecha limite"}</span>
                  </div>
                  <StatusBadge label={taskStatusLabels[task.status]} tone={task.status === "completed" ? "success" : task.status === "blocked" ? "danger" : "info"} />
                  <span>{task.assignedWorkerName || "Sin asignar"}</span>
                  <select
                    className="select"
                    value={task.status}
                    onChange={(event) => void handleTaskUpdate(task.taskId, { status: event.target.value as JobTask["status"] })}
                    disabled={saving}
                    aria-label="Estado de tarea"
                  >
                    {Object.entries(taskStatusLabels).map(([value, label]) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </select>
                </article>
              ))}
            </div>
            <div className="responsive-table" style={{ marginTop: 16 }}>
              <div className="table-header payment-row-grid">
                <span>Cambio</span>
                <span>Importe</span>
                <span>Estado</span>
                <span>Fecha</span>
              </div>
              {detail.changeRequests.length === 0 ? <p className="activity-meta">Sin cambios registrados en esta obra.</p> : null}
              {detail.changeRequests.map((change) => (
                <article className="table-row payment-row-grid" key={change.changeRequestId}>
                  <strong>{change.title}</strong>
                  <span>{formatMoney(change.amountDelta)}</span>
                  <StatusBadge label={change.status} tone={change.status === "approved" ? "success" : change.status === "rejected" ? "danger" : "warning"} />
                  <span>{new Date(change.createdAt).toLocaleDateString()}</span>
                </article>
              ))}
            </div>
          </div>

          <aside className="card">
            <div className="card-title-row">
              <h2 className="card-title">Equipo de la obra</h2>
              <StatusBadge label={`${detail.assignments?.length || 0} asignados`} tone="info" />
            </div>
            <div className="activity-list">
              {(detail.assignments || []).length === 0 ? <p className="activity-meta">Sin trabajadores asignados directamente a esta obra.</p> : null}
              {(detail.assignments || []).map((assignment) => (
                <article className="activity-item" key={assignment.assignmentId}>
                  <span className="activity-icon"><UserPlus size={18} /></span>
                  <div>
                    <strong>{assignment.workerName}</strong>
                    <span>{assignment.status}</span>
                  </div>
                </article>
              ))}
            </div>
            <Button variant="secondary" type="button" icon={<Plus size={16} />} onClick={() => setActivePanel(activePanel === "change" ? null : "change")}>
              Registrar cambio
            </Button>
          </aside>
        </section>
      ) : null}

      <BasicModal title="Editar obra" open={Boolean(detail && activePanel === "edit")} onClose={() => setActivePanel(null)} size="wide" footer={null}>
        <form className="auth-form" onSubmit={handleUpdateJob}>
          <div className="card-title-row">
            <span className="activity-meta">La direccion y radio alimentan el control de asistencia por ubicacion.</span>
            <StatusBadge label={editForm.projectLatitude && editForm.projectLongitude ? "GPS completo" : "Falta GPS"} tone={editForm.projectLatitude && editForm.projectLongitude ? "success" : "warning"} />
          </div>
          <label className="form-control">
            <span>Titulo</span>
            <input className="input" value={editForm.title || ""} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} required />
          </label>
          <label className="form-control">
            <span>Direccion de obra</span>
            <input className="input" value={editForm.projectAddress || ""} onChange={(event) => setEditForm({ ...editForm, projectAddress: event.target.value })} />
          </label>
          <div className="grid proof-grid">
            <label className="form-control">
              <span>Latitud GPS</span>
              <input className="input" type="number" step="0.000001" value={editForm.projectLatitude ?? ""} onChange={(event) => setEditForm({ ...editForm, projectLatitude: event.target.value ? Number(event.target.value) : null })} />
            </label>
            <label className="form-control">
              <span>Longitud GPS</span>
              <input className="input" type="number" step="0.000001" value={editForm.projectLongitude ?? ""} onChange={(event) => setEditForm({ ...editForm, projectLongitude: event.target.value ? Number(event.target.value) : null })} />
            </label>
            <label className="form-control">
              <span>Radio permitido (m)</span>
              <input className="input" type="number" min="25" max="5000" value={editForm.allowedRadiusMeters || 250} onChange={(event) => setEditForm({ ...editForm, allowedRadiusMeters: Number(event.target.value) })} />
            </label>
            <div className="form-control">
              <span>Ubicacion actual</span>
              <Button variant="secondary" type="button" icon={<MapPin size={16} />} onClick={() => void useCurrentLocation("edit")} disabled={saving}>
                Usar mi ubicacion
              </Button>
            </div>
            <label className="form-control">
              <span>Estado</span>
              <select className="select" value={editForm.status || "planned"} onChange={(event) => setEditForm({ ...editForm, status: event.target.value as JobStatus })}>
                {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </label>
          </div>
          <Button variant="primary" type="submit" icon={<Save size={16} />} disabled={saving}>Guardar obra</Button>
        </form>
      </BasicModal>

      <BasicModal title="Asignar trabajador a obra" open={Boolean(detail && activePanel === "assign")} onClose={() => setActivePanel(null)} size="wide" footer={null}>
        <form className="auth-form" onSubmit={handleAssignWorker}>
          <div className="card-title-row">
            <span className="activity-meta">Solo trabajadores asignados veran esta obra y sus tareas desde su perfil.</span>
            <StatusBadge label="Tenant activo" tone="success" />
          </div>
          <label className="form-control">
            <span>Trabajador</span>
            <select className="select" value={assignmentWorkerId} onChange={(event) => setAssignmentWorkerId(event.target.value)} required>
              <option value="">Seleccionar trabajador</option>
              {assignableWorkers.map((worker) => (
                <option value={worker.workerId} key={worker.workerId}>{worker.name}</option>
              ))}
            </select>
          </label>
          {assignableWorkers.length === 0 ? <p className="activity-meta">Todos los trabajadores activos ya estan asignados o no hay trabajadores disponibles.</p> : null}
          <Button variant="primary" type="submit" icon={<UserPlus size={16} />} disabled={saving || assignableWorkers.length === 0}>Asignar trabajador</Button>
        </form>
      </BasicModal>

      <BasicModal title="Agregar tarea al checklist" open={Boolean(detail && activePanel === "task")} onClose={() => setActivePanel(null)} size="wide" footer={null}>
        <form className="auth-form" onSubmit={handleCreateTask}>
          <div className="card-title-row">
            <span className="activity-meta">La tarea puede quedar visible para el trabajador asignado a esta obra.</span>
            <StatusBadge label="Visible al trabajador asignado" tone="info" />
          </div>
          <label className="form-control">
            <span>Nueva tarea</span>
            <input className="input" value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} required />
          </label>
          <label className="form-control">
            <span>Fase</span>
            <select className="select" value={taskForm.phaseId} onChange={(event) => setTaskForm({ ...taskForm, phaseId: event.target.value })}>
              <option value="">Primera fase activa</option>
              {(detail?.phases || []).map((phase) => (
                <option value={phase.phaseId} key={phase.phaseId}>{phase.title}</option>
              ))}
            </select>
          </label>
          <div className="grid proof-grid">
            <label className="form-control">
              <span>Trabajador asignado</span>
              <select className="select" value={taskForm.assignedToWorkerId} onChange={(event) => setTaskForm({ ...taskForm, assignedToWorkerId: event.target.value })}>
                <option value="">Sin asignar</option>
                {jobTeamWorkers.map((worker) => (
                  <option value={worker.workerId} key={worker.workerId}>{worker.name}</option>
                ))}
              </select>
              {jobTeamWorkers.length === 0 ? <span className="activity-meta">Primero asigna trabajadores a esta obra para que puedan ver tareas.</span> : null}
            </label>
            <label className="form-control">
              <span>Fecha limite opcional</span>
              <input className="input" type="date" value={taskForm.dueAt} onChange={(event) => setTaskForm({ ...taskForm, dueAt: event.target.value })} />
            </label>
          </div>
          <Button variant="primary" type="submit" icon={<Plus size={16} />} disabled={saving}>Agregar tarea</Button>
        </form>
      </BasicModal>

      <BasicModal title="Solicitud de cambio" open={Boolean(detail && activePanel === "change")} onClose={() => setActivePanel(null)} size="wide" footer={null}>
        <form className="auth-form" onSubmit={handleCreateChange}>
          <div className="card-title-row">
            <span className="activity-meta">Los cambios quedan trazables y pueden alimentar costo/rentabilidad.</span>
            <StatusBadge label="Trazable" tone="warning" />
          </div>
          <label className="form-control">
            <span>Solicitud de cambio</span>
            <input className="input" value={changeTitle} onChange={(event) => setChangeTitle(event.target.value)} required />
          </label>
          <label className="form-control">
            <span>Diferencia de importe</span>
            <input className="input" type="number" step="0.01" value={changeAmount} onChange={(event) => setChangeAmount(Number(event.target.value))} />
          </label>
          <Button variant="primary" type="submit" icon={<Plus size={16} />} disabled={saving}>Registrar cambio</Button>
        </form>
      </BasicModal>
    </section>
  );
}

function jobToEditForm(job: JobSummary): Partial<JobInput> & { status?: JobStatus } {
  return {
    title: job.title,
    status: job.status,
    scheduledStart: job.scheduledStart,
    scheduledEnd: job.scheduledEnd,
    projectAddress: job.projectAddress || "",
    projectLatitude: job.projectLatitude ?? null,
    projectLongitude: job.projectLongitude ?? null,
    allowedRadiusMeters: job.allowedRadiusMeters || 250,
  };
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
        </div>
        <span className="stat-icon info">{icon}</span>
      </div>
      <span className="stat-note">Calculado en PostgreSQL para el tenant activo</span>
    </article>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD" }).format(value || 0);
}

function dispatchDataChanged(module: string) {
  window.dispatchEvent(new CustomEvent("constriqo:data-changed", { detail: { module } }));
}
