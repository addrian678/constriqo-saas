import { CheckCircle2, Clock3, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { AuthenticatedSession } from "../../../app/auth/authClient";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { approveTimeEntry, listTimeEntries, type AttendanceBlockedAttempt, type AttendanceStatus, type TimeEntry } from "../api/attendanceClient";

type AttendanceRealPageProps = {
  session: AuthenticatedSession;
};

const statusLabels: Record<AttendanceStatus, string> = {
  active: "Activa",
  on_break: "En descanso",
  submitted: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

const statusTone: Record<AttendanceStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  active: "success",
  on_break: "warning",
  submitted: "info",
  approved: "success",
  rejected: "danger",
  cancelled: "warning",
};

export function AttendanceRealPage({ session }: AttendanceRealPageProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [blockedAttempts, setBlockedAttempts] = useState<AttendanceBlockedAttempt[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [attendanceLoadedAt, setAttendanceLoadedAt] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const hasOpenEntries = entries.some((entry) => !entry.clockOut && (entry.status === "active" || entry.status === "on_break"));
  const now = useClockTicker(hasOpenEntries);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!hasOpenEntries) {
      return;
    }
    const interval = window.setInterval(() => {
      void refresh({ preserveMessage: true, silent: true });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [hasOpenEntries]);

  async function refresh(options: { preserveMessage?: boolean; silent?: boolean } = {}) {
    if (!options.silent) {
      setLoading(true);
    }
    if (!options.preserveMessage) {
      setMessage(null);
    }
    try {
      const result = await listTimeEntries(session.sessionToken);
      setEntries(result.items);
      setBlockedAttempts(result.blockedAttempts || []);
      setSummary(result.summary || {});
      setAttendanceLoadedAt(Date.now());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar asistencia.");
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }

  async function review(entry: TimeEntry, status: "approved" | "rejected") {
    setSaving(true);
    setMessage(null);
    try {
      await approveTimeEntry(session.sessionToken, entry.timeEntryId, { status });
      setMessage(status === "approved" ? "Jornada aprobada." : "Jornada rechazada.");
      dispatchDataChanged("attendance");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo revisar la jornada.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="production-module-content">
      <PageHeader
        eyebrow="Control horario real"
        title="Asistencia"
        description="Revision de entradas, descansos, salidas y ubicacion puntual. No hay seguimiento continuo."
        actions={
          <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>
            Actualizar
          </Button>
        }
      />

      {message ? <p className="login-notice">{message}</p> : null}

      <section className="grid stats-grid crm-real-stats">
        <SummaryCard label="Registros" value={loading && entries.length === 0 ? "Cargando" : summary.total || 0} icon={<Clock3 size={20} />} />
        <SummaryCard label="Abiertas" value={loading && entries.length === 0 ? "Cargando" : summary.open || 0} icon={<ShieldCheck size={20} />} />
        <SummaryCard label="Pendientes" value={loading && entries.length === 0 ? "Cargando" : summary.submitted || 0} icon={<RefreshCw size={20} />} />
        <SummaryCard label="Aprobadas" value={loading && entries.length === 0 ? "Cargando" : summary.approved || 0} icon={<CheckCircle2 size={20} />} />
        <SummaryCard label="Canceladas" value={loading && entries.length === 0 ? "Cargando" : summary.cancelled || 0} icon={<XCircle size={20} />} />
        <SummaryCard label="Fuera de radio" value={loading && entries.length === 0 ? "Cargando" : summary.outside_radius || 0} icon={<XCircle size={20} />} />
        <SummaryCard label="Alertas GPS" value={loading && entries.length === 0 ? "Cargando" : summary.location_warnings || 0} icon={<RefreshCw size={20} />} />
        <SummaryCard label="Entradas bloqueadas" value={loading && entries.length === 0 ? "Cargando" : summary.blocked_attempts || 0} icon={<AlertIcon />} />
      </section>

      {blockedAttempts.length > 0 ? (
        <section className="card">
          <div className="card-title-row">
            <h2 className="card-title">Intentos bloqueados por ubicacion</h2>
            <StatusBadge label={`${blockedAttempts.length} recientes`} tone="warning" />
          </div>
          <div className="responsive-table">
            {blockedAttempts.map((attempt) => (
              <article className="table-row attendance-table-grid" key={attempt.attendanceExceptionId}>
                <div>
                  <strong>{attempt.workerName}</strong>
                  <span className="activity-meta">{attempt.jobTitle || "Obra no disponible"}</span>
                </div>
                <div>
                  <strong>{formatDateTime(attempt.attemptedAt)}</strong>
                  <span className="activity-meta">{attempt.attemptedLocation ? `${attempt.attemptedLocation.lat.toFixed(5)}, ${attempt.attemptedLocation.lng.toFixed(5)}` : "Sin GPS trabajador"}</span>
                </div>
                <StatusBadge label={blockedLocationLabel(attempt)} tone="danger" />
                <span>{attempt.description}</span>
                <span className="activity-meta">No genero jornada ni horas de nomina.</span>
                <span className="activity-meta">Pendiente de revision</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="card">
        <div className="card-title-row">
          <h2 className="card-title">Jornadas</h2>
          <StatusBadge label={loading ? "Cargando" : `${entries.length} registros`} tone="info" />
        </div>
        {!loading && entries.length === 0 ? <EmptyState title="Sin registros" description="Cuando un trabajador registre entrada apareceran aqui." /> : null}
        <div className="responsive-table">
          {entries.map((entry) => {
            const live = calculateEntryLiveSeconds(entry, now, attendanceLoadedAt);
            const isLive = !entry.clockOut && (entry.status === "active" || entry.status === "on_break");
            return (
              <article className="table-row attendance-table-grid" key={entry.timeEntryId}>
                <div>
                  <strong>{entry.workerName}</strong>
                  <span className="activity-meta">{entry.jobTitle || "Sin obra asignada"}</span>
                </div>
                <div>
                  <strong>{formatDateTime(entry.clockIn)}</strong>
                  <span className="activity-meta">{entry.clockOut ? formatDateTime(entry.clockOut) : "Jornada abierta"}</span>
                </div>
                <StatusBadge label={statusLabels[entry.status]} tone={statusTone[entry.status]} />
                <StatusBadge label={locationLabel(entry)} tone={entry.locationStatus === "outside_radius" ? "danger" : entry.locationStatus === "inside_radius" ? "success" : "warning"} />
                <div>
                  <strong>{isLive ? formatClockDuration(live.workedSeconds) : `${formatHours(live.workedSeconds)} h`}</strong>
                  <span className="activity-meta">Descanso {isLive ? formatWorkDuration(live.breakSeconds) : `${formatHours(live.breakSeconds)} h`} · {entry.payrollStatus === "paid" ? "Pagada" : entry.payrollStatus === "excluded" ? "Excluida" : "Por pagar"}</span>
                  {isLive ? <span className="activity-meta">Estimado en vivo desde datos oficiales · sincroniza cada 60 s</span> : null}
                  {entry.cancelReason ? <span className="activity-meta">Motivo: {entry.cancelReason}</span> : null}
                </div>
                <div className="segmented-actions">
                  <Button variant="secondary" type="button" icon={<CheckCircle2 size={16} />} onClick={() => void review(entry, "approved")} disabled={saving || entry.status === "approved" || entry.status === "cancelled"}>
                    Aprobar
                  </Button>
                  <Button variant="secondary" type="button" icon={<XCircle size={16} />} onClick={() => void review(entry, "rejected")} disabled={saving || entry.status === "rejected" || entry.status === "cancelled"}>
                    Rechazar
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
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
      <span className="stat-note">Calculado en PostgreSQL para el tenant activo</span>
    </article>
  );
}

function formatDateTime(value: string) {
  return value ? new Date(value).toLocaleString() : "";
}

function formatHours(seconds: number) {
  return (Math.max(0, seconds) / 3600).toFixed(2);
}

function formatClockDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const rest = safeSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function formatWorkDuration(seconds: number) {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes} min`;
  }
  return `${hours} h ${minutes} min`;
}

function useClockTicker(active: boolean) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (!active) {
      return;
    }
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [active]);

  return now;
}

function calculateEntryLiveSeconds(entry: TimeEntry, nowMs: number, attendanceLoadedAt: number) {
  const clockInMs = Date.parse(entry.clockIn);
  const clockOutMs = entry.clockOut ? Date.parse(entry.clockOut) : nowMs;
  const safeClockOutMs = Number.isFinite(clockOutMs) ? clockOutMs : nowMs;
  let breakSeconds = Math.max(0, Number(entry.breakSeconds || 0));

  if (!entry.clockOut && entry.activeBreak) {
    breakSeconds += Math.max(0, Math.floor((nowMs - attendanceLoadedAt) / 1000));
  }

  if (entry.clockOut) {
    return {
      workedSeconds: Math.max(0, Number(entry.totalSeconds || 0)),
      breakSeconds,
    };
  }

  const grossSeconds = Math.max(0, Math.floor((safeClockOutMs - clockInMs) / 1000));
  return {
    workedSeconds: Math.max(0, grossSeconds - breakSeconds),
    breakSeconds,
  };
}

function locationLabel(entry: TimeEntry) {
  if (entry.locationStatus === "inside_radius") {
    return `En radio${entry.jobDistanceMeters !== null && entry.jobDistanceMeters !== undefined ? ` ${entry.jobDistanceMeters} m` : ""}`;
  }
  if (entry.locationStatus === "outside_radius") {
    return `Fuera de radio${entry.jobDistanceMeters !== null && entry.jobDistanceMeters !== undefined ? ` ${entry.jobDistanceMeters} m` : ""}`;
  }
  if (entry.locationStatus === "missing_worker_location") {
    return "Sin GPS trabajador";
  }
  if (entry.locationStatus === "job_without_location") {
    return "Obra sin GPS";
  }
  return "No verificado";
}

function blockedLocationLabel(attempt: AttendanceBlockedAttempt) {
  if (attempt.locationStatus === "outside_radius") {
    return `Fuera de radio${attempt.jobDistanceMeters !== null && attempt.jobDistanceMeters !== undefined ? ` ${attempt.jobDistanceMeters} m` : ""}`;
  }
  if (attempt.locationStatus === "missing_worker_location") {
    return "Sin GPS trabajador";
  }
  if (attempt.locationStatus === "job_without_location") {
    return "Obra sin GPS";
  }
  return "Entrada bloqueada";
}

function AlertIcon() {
  return <XCircle size={20} />;
}

function dispatchDataChanged(module: string) {
  window.dispatchEvent(new CustomEvent("constriqo:data-changed", { detail: { module } }));
}
