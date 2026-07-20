import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Coffee,
  Eye,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageCircle,
  Phone,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthenticatedSession } from "./auth/authClient";
import { Button } from "../shared/components/Button";
import { BasicModal } from "../shared/components/BasicModal";
import { EmptyState } from "../shared/components/EmptyState";
import { PageHeader } from "../shared/components/PageHeader";
import { StatusBadge } from "../shared/components/StatusBadge";
import { ToastViewport } from "../shared/components/ToastViewport";
import {
  clockIn,
  clockOut,
  endBreak,
  getMyAttendance,
  startBreak,
  type MyAttendance,
} from "../modules/attendance/api/attendanceClient";
import { listWorkerTasks, type JobTask, type WorkerTask, updateWorkerTask } from "../modules/jobs/api/jobClient";
import { listRuntimeNotifications, markRuntimeNotificationRead, type RuntimeNotification } from "../modules/notifications/api/notificationsClient";
import { getTenantSettings, type TenantSettings } from "../modules/organization/api/organizationClient";
import { capturePointInTimeLocation } from "./native/nativeCapabilities";
import { refreshTenantWorkspaceCache, warmTenantWorkspaceCache } from "./cache/workspaceCache";

type WorkerProductionWorkspaceProps = {
  session: AuthenticatedSession;
  busy?: boolean;
  onLogout: () => void;
};

type WorkerSection = "dashboard" | "attendance" | "checklist" | "alerts";

const taskStatusLabels: Record<JobTask["status"], string> = {
  pending: "Pendiente",
  in_progress: "En progreso",
  blocked: "Bloqueada",
  completed: "Completada",
};

const taskStatusTone: Record<JobTask["status"], "neutral" | "info" | "warning" | "success" | "danger"> = {
  pending: "neutral",
  in_progress: "info",
  blocked: "danger",
  completed: "success",
};

const workerSections: Array<{ id: WorkerSection; label: string; icon: ReactNode }> = [
  { id: "dashboard", label: "Inicio", icon: <LayoutDashboard size={16} /> },
  { id: "attendance", label: "Jornada", icon: <Clock3 size={16} /> },
  { id: "checklist", label: "Checklist", icon: <ClipboardList size={16} /> },
  { id: "alerts", label: "Alertas", icon: <Bell size={16} /> },
];

export function WorkerProductionWorkspace({ session, busy, onLogout }: WorkerProductionWorkspaceProps) {
  useMemo(() => warmTenantWorkspaceCache(session), [session]);

  const [activeSection, setActiveSection] = useState<WorkerSection>("dashboard");
  const [tasks, setTasks] = useState<WorkerTask[]>([]);
  const [notifications, setNotifications] = useState<RuntimeNotification[]>([]);
  const [attendance, setAttendance] = useState<MyAttendance | null>(null);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [workerName, setWorkerName] = useState(session.user.displayName);
  const [selectedClockJobId, setSelectedClockJobId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reportingTask, setReportingTask] = useState<WorkerTask | null>(null);
  const [reportNote, setReportNote] = useState("");

  const activeTasks = useMemo(() => tasks.filter((task) => task.status !== "completed"), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.status === "completed"), [tasks]);
  const unreadNotifications = useMemo(() => notifications.filter((notification) => notification.status !== "read"), [notifications]);
  const assignedJobs = useMemo(() => {
    const byId = new Map<string, WorkerTask>();
    for (const task of tasks) {
      byId.set(task.jobId, task);
    }
    return Array.from(byId.values());
  }, [tasks]);
  const jobProgress = useMemo(() => {
    return assignedJobs.map((task) => ({
      jobId: task.jobId,
      jobNumber: task.jobNumber,
      jobTitle: task.jobTitle,
      clientName: task.clientName,
      total: task.jobTotalTasks || tasks.filter((candidate) => candidate.jobId === task.jobId).length,
      completed: task.jobCompletedTasks || tasks.filter((candidate) => candidate.jobId === task.jobId && candidate.status === "completed").length,
      progress: task.jobProgressPercent || calculatePercent(
        tasks.filter((candidate) => candidate.jobId === task.jobId && candidate.status === "completed").length,
        tasks.filter((candidate) => candidate.jobId === task.jobId).length,
      ),
    }));
  }, [assignedJobs, tasks]);
  const supportPhone = settings?.workerSupportPhone || settings?.companyPhone || "";
  const supportWhatsappUrl = settings?.workerSupportWhatsappUrl || buildWhatsappUrl(supportPhone);
  const currentJobLabel = attendance?.openEntry?.jobNumber
    ? `${attendance.openEntry.jobNumber} - ${attendance.openEntry.jobTitle || "Obra activa"}`
    : "";

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    function handleDataChanged() {
      refreshTenantWorkspaceCache(session);
    }

    window.addEventListener("constructflow:data-changed", handleDataChanged);
    return () => {
      window.removeEventListener("constructflow:data-changed", handleDataChanged);
    };
  }, [session]);

  async function refresh(options: { preserveMessage?: boolean } = {}) {
    setLoading(true);
    if (!options.preserveMessage) {
      setMessage(null);
    }
    try {
      const [result, attendanceResult, notificationResult, settingsResult] = await Promise.all([
        listWorkerTasks(session.sessionToken),
        getMyAttendance(session.sessionToken).catch(() => null),
        listRuntimeNotifications(session.sessionToken, { role: "worker" }).catch(() => ({ items: [], summary: { total: 0, pending: 0, read: 0, important: 0 } })),
        getTenantSettings(session.sessionToken).catch(() => null),
      ]);
      setWorkerName(result.worker.name);
      setTasks(result.items);
      setNotifications(notificationResult.items);
      setSummary(result.summary || {});
      setAttendance(attendanceResult);
      setSettings(settingsResult);
      setSelectedClockJobId((current) => {
        if (attendanceResult?.openEntry?.jobId) {
          return attendanceResult.openEntry.jobId;
        }
        return current || result.items[0]?.jobId || "";
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar tus tareas.");
    } finally {
      setLoading(false);
    }
  }

  async function handleClockIn() {
    if (!selectedClockJobId) {
      setMessage("Selecciona una obra asignada antes de registrar entrada.");
      setActiveSection("attendance");
      return;
    }
    setSavingTaskId("attendance");
    setMessage(null);
    try {
      await clockIn(session.sessionToken, { jobId: selectedClockJobId, location: await capturePointInTimeLocation() });
      setMessage("Entrada registrada correctamente.");
      setActiveSection("attendance");
      dispatchDataChanged("attendance");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar entrada.");
    } finally {
      setSavingTaskId(null);
    }
  }

  async function handleBreakStart() {
    setSavingTaskId("attendance");
    setMessage(null);
    try {
      await startBreak(session.sessionToken);
      setMessage("Descanso iniciado.");
      setActiveSection("attendance");
      dispatchDataChanged("attendance");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo iniciar descanso.");
    } finally {
      setSavingTaskId(null);
    }
  }

  async function handleBreakEnd() {
    setSavingTaskId("attendance");
    setMessage(null);
    try {
      await endBreak(session.sessionToken);
      setMessage("Descanso terminado.");
      setActiveSection("attendance");
      dispatchDataChanged("attendance");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo terminar descanso.");
    } finally {
      setSavingTaskId(null);
    }
  }

  async function handleClockOut() {
    setSavingTaskId("attendance");
    setMessage(null);
    try {
      await clockOut(session.sessionToken, { location: await capturePointInTimeLocation() });
      setMessage("Salida registrada correctamente.");
      setActiveSection("attendance");
      dispatchDataChanged("attendance");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar salida.");
    } finally {
      setSavingTaskId(null);
    }
  }

  async function changeStatus(taskId: string, status: JobTask["status"], nextReportNote = "") {
    setSavingTaskId(taskId);
    setMessage(null);
    try {
      await updateWorkerTask(session.sessionToken, taskId, { status, reportNote: nextReportNote });
      setMessage(status === "completed" ? "Tarea marcada como completada." : status === "blocked" ? "Problema reportado al administrador." : "Tarea iniciada.");
      setActiveSection("checklist");
      dispatchDataChanged("jobs");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la tarea.");
    } finally {
      setSavingTaskId(null);
    }
  }

  async function handleSubmitReport() {
    if (!reportingTask) {
      return;
    }
    const note = reportNote.trim();
    if (!note) {
      setMessage("Escribe el problema antes de reportarlo.");
      return;
    }
    const task = reportingTask;
    setReportingTask(null);
    setReportNote("");
    await changeStatus(task.taskId, "blocked", note);
  }

  async function handleMarkNotificationRead(notificationId: string) {
    setSavingTaskId(`notification:${notificationId}`);
    setMessage(null);
    try {
      await markRuntimeNotificationRead(session.sessionToken, notificationId);
      setMessage("Notificacion marcada como vista.");
      setActiveSection("alerts");
      dispatchDataChanged("notifications");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo marcar la notificacion.");
    } finally {
      setSavingTaskId(null);
    }
  }

  return (
    <main className="app-shell production-shell">
      <div className="production-topbar">
        <div className="brand-lockup">
          <span className="brand-mark">CF</span>
          <div>
            <p className="brand-name">ConstructFlow</p>
            <p className="brand-subtitle">{session.tenant.companyName}</p>
          </div>
        </div>
        <nav className="worker-module-tabs" aria-label="Menu trabajador">
          {workerSections.map((section) => (
            <button
              className={activeSection === section.id ? "active" : ""}
              type="button"
              onClick={() => setActiveSection(section.id)}
              key={section.id}
            >
              {section.icon}
              <span>{section.label}</span>
            </button>
          ))}
        </nav>
        <div className="production-session">
          <span>{workerName}</span>
          <Button variant="secondary" type="button" icon={<LogOut size={16} />} onClick={onLogout} disabled={busy}>
            Cerrar sesion
          </Button>
        </div>
      </div>

      <section className="content">
        <section className="production-module-content">
          <PageHeader
            eyebrow="Perfil trabajador"
            title={sectionTitle(activeSection)}
            description="Solo ves datos enlazados a tu usuario y empresa. La ubicacion se toma puntualmente al registrar jornada."
            actions={
              <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>
                Actualizar
              </Button>
            }
          />

          {message ? <p className="login-notice">{message}</p> : null}

          {activeSection === "dashboard" ? (
            <WorkerDashboard
              summary={summary}
              loading={loading}
              jobProgress={jobProgress}
              unreadNotifications={unreadNotifications.length}
              onOpenSection={setActiveSection}
            />
          ) : null}

          {activeSection === "attendance" ? (
            <WorkerAttendance
              attendance={attendance}
              assignedJobs={assignedJobs}
              selectedClockJobId={selectedClockJobId}
              setSelectedClockJobId={setSelectedClockJobId}
              saving={savingTaskId === "attendance"}
              currentJobLabel={currentJobLabel}
              onClockIn={handleClockIn}
              onBreakStart={handleBreakStart}
              onBreakEnd={handleBreakEnd}
              onClockOut={handleClockOut}
            />
          ) : null}

          {activeSection === "checklist" ? (
            <WorkerChecklist
              loading={loading}
              activeTasks={activeTasks}
              completedTasks={completedTasks}
              savingTaskId={savingTaskId}
              supportPhone={supportPhone}
              supportWhatsappUrl={supportWhatsappUrl}
              onChangeStatus={changeStatus}
              onOpenReport={(task) => {
                setReportingTask(task);
                setReportNote("");
              }}
            />
          ) : null}

          {activeSection === "alerts" ? (
            <WorkerAlerts
              notifications={notifications}
              unreadCount={unreadNotifications.length}
              savingTaskId={savingTaskId}
              onMarkRead={handleMarkNotificationRead}
            />
          ) : null}
        </section>
      </section>

      <BasicModal title="Reportar problema" open={Boolean(reportingTask)} onClose={() => setReportingTask(null)} size="wide" footer={null}>
        <div className="card-title-row">
          <span className="activity-meta">{reportingTask?.jobNumber} - {reportingTask?.jobTitle}</span>
          <StatusBadge label="Aviso al admin" tone="warning" />
        </div>
        <label className="form-control" style={{ marginTop: 12 }}>
          <span>Describe el problema</span>
          <textarea
            className="input"
            rows={5}
            placeholder="Ejemplo: falta material, se dano una herramienta, no puedo continuar la tarea..."
            value={reportNote}
            onChange={(event) => setReportNote(event.target.value)}
          />
        </label>
        <div className="segmented-actions">
          <Button variant="primary" type="button" icon={<AlertTriangle size={16} />} onClick={() => void handleSubmitReport()}>
            Reportar problema
          </Button>
          <Button variant="secondary" type="button" onClick={() => setReportingTask(null)}>
            Cancelar
          </Button>
        </div>
      </BasicModal>

      <ToastViewport />
      <footer className="powered-footer">Software impulsado por ConstructFlow</footer>
    </main>
  );
}

function WorkerDashboard({
  summary,
  loading,
  jobProgress,
  unreadNotifications,
  onOpenSection,
}: {
  summary: Record<string, number>;
  loading: boolean;
  jobProgress: Array<{ jobId: string; jobNumber: string; jobTitle: string; clientName: string; total: number; completed: number; progress: number }>;
  unreadNotifications: number;
  onOpenSection: (section: WorkerSection) => void;
}) {
  return (
    <>
      <section className="grid stats-grid crm-real-stats">
        <SummaryCard label="Asignadas" value={loading && !summary.total ? "Cargando" : summary.total || 0} icon={<Clock3 size={20} />} />
        <SummaryCard label="En progreso" value={summary.in_progress || 0} icon={<ShieldCheck size={20} />} />
        <SummaryCard label="Bloqueadas" value={summary.blocked || 0} icon={<RefreshCw size={20} />} />
        <SummaryCard label="Completadas" value={summary.completed || 0} icon={<CheckCircle2 size={20} />} />
      </section>

      <section className="grid two-column crm-real-grid">
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Avance por obra</h2>
            <StatusBadge label={`${jobProgress.length} obras`} tone="info" />
          </div>
          {jobProgress.length === 0 ? (
            <EmptyState title="Sin obras asignadas" description="Cuando te asignen tareas de una obra apareceran aqui." />
          ) : (
            <div className="activity-list">
              {jobProgress.map((job) => (
                <article className="worker-progress-item" key={job.jobId}>
                  <div className="card-title-row">
                    <div>
                      <strong>{job.jobNumber} - {job.jobTitle}</strong>
                      <span className="activity-meta">{job.clientName} · {job.completed}/{job.total} tareas completadas</span>
                    </div>
                    <StatusBadge label={`${job.progress}%`} tone={job.progress >= 100 ? "success" : "info"} />
                  </div>
                  <div className="progress-track" aria-label={`Avance ${job.progress}%`}>
                    <span style={{ width: `${job.progress}%` }} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
        <aside className="card">
          <div className="card-title-row">
            <h2 className="card-title">Accesos rapidos</h2>
            <StatusBadge label={`${unreadNotifications} alertas`} tone={unreadNotifications > 0 ? "warning" : "success"} />
          </div>
          <div className="worker-quick-actions">
            <Button variant="primary" type="button" icon={<Clock3 size={16} />} onClick={() => onOpenSection("attendance")}>
              Registrar jornada
            </Button>
            <Button variant="secondary" type="button" icon={<ClipboardList size={16} />} onClick={() => onOpenSection("checklist")}>
              Ver checklist
            </Button>
            <Button variant="secondary" type="button" icon={<Bell size={16} />} onClick={() => onOpenSection("alerts")}>
              Ver alertas
            </Button>
          </div>
        </aside>
      </section>
    </>
  );
}

function WorkerAttendance({
  attendance,
  assignedJobs,
  selectedClockJobId,
  setSelectedClockJobId,
  saving,
  currentJobLabel,
  onClockIn,
  onBreakStart,
  onBreakEnd,
  onClockOut,
}: {
  attendance: MyAttendance | null;
  assignedJobs: WorkerTask[];
  selectedClockJobId: string;
  setSelectedClockJobId: (value: string) => void;
  saving: boolean;
  currentJobLabel: string;
  onClockIn: () => Promise<void>;
  onBreakStart: () => Promise<void>;
  onBreakEnd: () => Promise<void>;
  onClockOut: () => Promise<void>;
}) {
  const openStatus = attendance?.openEntry?.status || "";
  return (
    <section className="card">
      <div className="card-title-row">
        <div>
          <h2 className="card-title">Mi jornada</h2>
          <p className="activity-meta">Entrada y salida quedan vinculadas a una obra asignada.</p>
        </div>
        <StatusBadge label={openStatus || "sin_jornada"} tone={attendance?.openEntry ? "success" : "neutral"} />
      </div>
      {currentJobLabel ? <p className="login-security-note">Jornada activa en {currentJobLabel}.</p> : null}
      <label className="form-control" style={{ marginTop: 12 }}>
        <span>Obra para registrar entrada</span>
        <select className="select" value={selectedClockJobId} onChange={(event) => setSelectedClockJobId(event.target.value)} disabled={Boolean(attendance?.openEntry)}>
          <option value="">Selecciona una obra asignada</option>
          {assignedJobs.map((task) => (
            <option value={task.jobId} key={task.jobId}>
              {task.jobNumber} - {task.jobTitle}
            </option>
          ))}
        </select>
      </label>
      <div className="worker-actions" style={{ marginTop: 12 }}>
        <Button variant="primary" type="button" icon={<LogIn size={18} />} onClick={() => void onClockIn()} disabled={Boolean(attendance?.openEntry) || !selectedClockJobId || saving}>
          Registrar entrada
        </Button>
        <Button variant="secondary" type="button" icon={<Coffee size={18} />} onClick={() => void onBreakStart()} disabled={openStatus !== "active" || saving}>
          Iniciar descanso
        </Button>
        <Button variant="secondary" type="button" icon={<Clock3 size={18} />} onClick={() => void onBreakEnd()} disabled={openStatus !== "on_break" || saving}>
          Terminar descanso
        </Button>
        <Button variant="danger" type="button" icon={<LogOut size={18} />} onClick={() => void onClockOut()} disabled={!attendance?.openEntry || saving}>
          Registrar salida
        </Button>
      </div>
    </section>
  );
}

function WorkerChecklist({
  loading,
  activeTasks,
  completedTasks,
  savingTaskId,
  supportPhone,
  supportWhatsappUrl,
  onChangeStatus,
  onOpenReport,
}: {
  loading: boolean;
  activeTasks: WorkerTask[];
  completedTasks: WorkerTask[];
  savingTaskId: string | null;
  supportPhone: string;
  supportWhatsappUrl: string;
  onChangeStatus: (taskId: string, status: JobTask["status"], reportNote?: string) => Promise<void>;
  onOpenReport: (task: WorkerTask) => void;
}) {
  return (
    <>
      <section className="card">
        <div className="card-title-row">
          <h2 className="card-title">Checklist activo</h2>
          <StatusBadge label={loading ? "Cargando" : `${activeTasks.length} pendientes`} tone="info" />
        </div>
        {!loading && activeTasks.length === 0 ? (
          <EmptyState title="Sin tareas activas" description="Cuando el administrador te asigne tareas pendientes apareceran aqui." />
        ) : null}
        <div className="worker-task-list">
          {activeTasks.map((task) => (
            <TaskRow
              task={task}
              saving={savingTaskId === task.taskId}
              supportPhone={supportPhone}
              supportWhatsappUrl={supportWhatsappUrl}
              onChangeStatus={onChangeStatus}
              onOpenReport={onOpenReport}
              key={task.taskId}
            />
          ))}
        </div>
      </section>

      {completedTasks.length > 0 ? (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="card-title-row">
            <h2 className="card-title">Completadas</h2>
            <StatusBadge label={`${completedTasks.length} tareas`} tone="success" />
          </div>
          <div className="worker-task-list">
            {completedTasks.map((task) => (
              <TaskRow
                task={task}
                saving={savingTaskId === task.taskId}
                supportPhone={supportPhone}
                supportWhatsappUrl={supportWhatsappUrl}
                onChangeStatus={onChangeStatus}
                onOpenReport={onOpenReport}
                key={task.taskId}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function WorkerAlerts({
  notifications,
  unreadCount,
  savingTaskId,
  onMarkRead,
}: {
  notifications: RuntimeNotification[];
  unreadCount: number;
  savingTaskId: string | null;
  onMarkRead: (notificationId: string) => Promise<void>;
}) {
  return (
    <section className="card">
      <div className="card-title-row">
        <div>
          <h2 className="card-title">Mis alertas</h2>
          <p className="activity-meta">Solo notificaciones dirigidas a tu rol o a tu usuario dentro de esta empresa.</p>
        </div>
        <StatusBadge label={`${unreadCount} pendientes`} tone={unreadCount > 0 ? "warning" : "success"} />
      </div>
      {notifications.length === 0 ? (
        <EmptyState title="Sin alertas" description="Cuando te asignen tareas o existan avisos para trabajadores apareceran aqui." />
      ) : (
        <div className="activity-list">
          {notifications.map((notification) => (
            <article className="activity-item" key={notification.notificationId}>
              <span className="activity-icon"><Bell size={18} /></span>
              <div>
                <p className="activity-title">{notification.title}</p>
                <p className="activity-meta">{notification.message}</p>
              </div>
              <Button
                variant="secondary"
                type="button"
                icon={<Eye size={15} />}
                onClick={() => void onMarkRead(notification.notificationId)}
                disabled={notification.status === "read" || savingTaskId === `notification:${notification.notificationId}`}
              >
                Vista
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function TaskRow({
  task,
  saving,
  supportPhone,
  supportWhatsappUrl,
  onChangeStatus,
  onOpenReport,
}: {
  task: WorkerTask;
  saving: boolean;
  supportPhone: string;
  supportWhatsappUrl: string;
  onChangeStatus: (taskId: string, status: JobTask["status"], reportNote?: string) => Promise<void>;
  onOpenReport: (task: WorkerTask) => void;
}) {
  const canStart = task.status === "pending";
  const canComplete = task.status === "in_progress";
  const canReport = task.status !== "completed";
  return (
    <article className="worker-task-card">
      <div className="card-title-row">
        <div>
          <strong>{task.title}</strong>
          <span className="activity-meta">
            {task.jobNumber} - {task.jobTitle} · {task.clientName}
          </span>
          {task.phaseTitle ? <span className="activity-meta">{task.phaseTitle}</span> : null}
          <span className="activity-meta">{task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "Sin fecha limite"}</span>
        </div>
        <StatusBadge label={taskStatusLabels[task.status]} tone={taskStatusTone[task.status]} />
      </div>
      <div className="worker-task-actions">
        {canStart ? (
          <Button variant="secondary" type="button" icon={<LogIn size={16} />} onClick={() => void onChangeStatus(task.taskId, "in_progress")} disabled={saving}>
            Iniciar tarea
          </Button>
        ) : null}
        {canComplete ? (
          <Button variant="primary" type="button" icon={<CheckCircle2 size={16} />} onClick={() => void onChangeStatus(task.taskId, "completed")} disabled={saving}>
            Completar
          </Button>
        ) : null}
        {task.status === "blocked" ? (
          <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void onChangeStatus(task.taskId, "in_progress")} disabled={saving}>
            Reanudar
          </Button>
        ) : null}
        {task.status === "completed" ? <StatusBadge label="Finalizada" tone="success" /> : null}
        {canReport ? (
          <Button variant="secondary" type="button" icon={<AlertTriangle size={16} />} onClick={() => onOpenReport(task)} disabled={saving}>
            Reportar problema
          </Button>
        ) : null}
        {supportWhatsappUrl ? (
          <Button variant="secondary" type="button" icon={<MessageCircle size={16} />} onClick={() => window.open(supportWhatsappUrl, "_blank", "noopener,noreferrer")}>
            WhatsApp
          </Button>
        ) : null}
        {supportPhone ? (
          <Button variant="secondary" type="button" icon={<Phone size={16} />} onClick={() => { window.location.href = `tel:${supportPhone}`; }}>
            Llamar
          </Button>
        ) : null}
      </div>
    </article>
  );
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
      <span className="stat-note">Filtrado por tu usuario y empresa</span>
    </article>
  );
}

function sectionTitle(section: WorkerSection) {
  return {
    dashboard: "Mis tareas",
    attendance: "Registro de jornada",
    checklist: "Checklist de tareas",
    alerts: "Mis alertas",
  }[section];
}

function buildWhatsappUrl(phone: string) {
  const clean = phone.replace(/[^\d+]/gu, "").replace(/^\+/u, "");
  return clean ? `https://wa.me/${clean}` : "";
}

function calculatePercent(completed: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.round((completed / total) * 100);
}

function dispatchDataChanged(module: string) {
  window.dispatchEvent(new CustomEvent("constructflow:data-changed", { detail: { module } }));
}
