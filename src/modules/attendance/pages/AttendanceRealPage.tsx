import { CheckCircle2, Clock3, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { AuthenticatedSession } from "../../../app/auth/authClient";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { approveTimeEntry, listTimeEntries, type AttendanceStatus, type TimeEntry } from "../api/attendanceClient";

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
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(options: { preserveMessage?: boolean } = {}) {
    setLoading(true);
    if (!options.preserveMessage) {
      setMessage(null);
    }
    try {
      const result = await listTimeEntries(session.sessionToken);
      setEntries(result.items);
      setSummary(result.summary || {});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar asistencia.");
    } finally {
      setLoading(false);
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
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2 className="card-title">Jornadas</h2>
          <StatusBadge label={loading ? "Cargando" : `${entries.length} registros`} tone="info" />
        </div>
        {!loading && entries.length === 0 ? <EmptyState title="Sin registros" description="Cuando un trabajador registre entrada apareceran aqui." /> : null}
        <div className="responsive-table">
          {entries.map((entry) => (
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
                <strong>{formatHours(entry.totalSeconds)} h</strong>
                <span className="activity-meta">Descanso {formatHours(entry.breakSeconds)} h · {entry.payrollStatus === "paid" ? "Pagada" : entry.payrollStatus === "excluded" ? "Excluida" : "Por pagar"}</span>
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
          ))}
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

function dispatchDataChanged(module: string) {
  window.dispatchEvent(new CustomEvent("constriqo:data-changed", { detail: { module } }));
}
