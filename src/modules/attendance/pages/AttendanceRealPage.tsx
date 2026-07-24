import { CheckCircle2, Clock3, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthenticatedSession } from "../../../app/auth/authClient";
import { BasicModal } from "../../../shared/components/BasicModal";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { approveTimeEntry, listTimeEntries, type AttendanceBlockedAttempt, type AttendanceStatus, type TimeEntry } from "../api/attendanceClient";

type AttendanceRealPageProps = {
  session: AuthenticatedSession;
};

type HistoryGroupMode = "day" | "week" | "biweekly" | "month" | "year";

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
  const [periodStart, setPeriodStart] = useState(() => monthStartDateInput());
  const [periodEnd, setPeriodEnd] = useState(() => todayDateInput());
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [historyGroup, setHistoryGroup] = useState<HistoryGroupMode>("day");
  const [attendanceLoadedAt, setAttendanceLoadedAt] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reviewIntent, setReviewIntent] = useState<{ entry: TimeEntry; status: "approved" | "rejected" } | null>(null);
  const hasOpenEntries = entries.some((entry) => !entry.clockOut && (entry.status === "active" || entry.status === "on_break"));
  const now = useClockTicker(hasOpenEntries);
  const workerOptions = useMemo(() => buildWorkerOptions(entries), [entries]);
  const historyGroups = useMemo(() => buildHistoryGroups(entries, historyGroup, now, attendanceLoadedAt), [entries, historyGroup, now, attendanceLoadedAt]);
  const historyTotals = useMemo(() => sumHistoryGroups(historyGroups), [historyGroups]);

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
  }, [hasOpenEntries, periodStart, periodEnd, selectedWorkerId]);

  async function refresh(options: { preserveMessage?: boolean; silent?: boolean } = {}) {
    if (!options.silent) {
      setLoading(true);
    }
    if (!options.preserveMessage) {
      setMessage(null);
    }
    try {
      const result = await listTimeEntries(session.sessionToken, {
        workerId: selectedWorkerId,
        startDate: periodStart,
        endDate: periodEnd,
        limit: 500,
      });
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

  async function review() {
    if (!reviewIntent) {
      return;
    }
    const { entry, status } = reviewIntent;
    setSaving(true);
    setMessage(null);
    try {
      await approveTimeEntry(session.sessionToken, entry.timeEntryId, { status });
      setMessage(status === "approved" ? "Jornada aprobada." : "Jornada rechazada.");
      setReviewIntent(null);
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
        <SummaryCard label="Requieren revision" value={loading && entries.length === 0 ? "Cargando" : summary.requires_review || 0} icon={<AlertIcon />} />
        <SummaryCard label="Fuera de radio" value={loading && entries.length === 0 ? "Cargando" : summary.outside_radius || 0} icon={<XCircle size={20} />} />
        <SummaryCard label="Alertas GPS" value={loading && entries.length === 0 ? "Cargando" : summary.location_warnings || 0} icon={<RefreshCw size={20} />} />
        <SummaryCard label="Entradas bloqueadas" value={loading && entries.length === 0 ? "Cargando" : summary.blocked_attempts || 0} icon={<AlertIcon />} />
      </section>

      <section className="card">
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Historial de asistencia</h2>
            <p className="section-subtitle">Consulta por trabajador y periodo sin cargar anos completos de una vez.</p>
          </div>
          <StatusBadge label={`${formatWorkDuration(historyTotals.workedSeconds)} trabajadas`} tone="info" />
        </div>
        <div className="form-grid">
          <label>
            <span>Desde</span>
            <input className="input" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
          </label>
          <label>
            <span>Hasta</span>
            <input className="input" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
          </label>
          <label>
            <span>Trabajador</span>
            <select className="select" value={selectedWorkerId} onChange={(event) => setSelectedWorkerId(event.target.value)}>
              <option value="">Todos los trabajadores</option>
              {workerOptions.map((worker) => (
                <option key={worker.workerId} value={worker.workerId}>
                  {worker.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Agrupar por</span>
            <select className="select" value={historyGroup} onChange={(event) => setHistoryGroup(event.target.value as HistoryGroupMode)}>
              <option value="day">Dia</option>
              <option value="week">Semana</option>
              <option value="biweekly">Quincena</option>
              <option value="month">Mes</option>
              <option value="year">Ano</option>
            </select>
          </label>
        </div>
        <div className="segmented-actions">
          <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>
            Actualizar historial
          </Button>
        </div>
        <div className="compact-fact-grid attendance-history-totals">
          <span>
            <strong>Horas trabajadas</strong>
            {formatWorkDuration(historyTotals.workedSeconds)}
          </span>
          <span>
            <strong>Descanso</strong>
            {formatWorkDuration(historyTotals.breakSeconds)}
          </span>
          <span>
            <strong>Jornadas</strong>
            {historyTotals.entries}
          </span>
          <span>
            <strong>Trabajadores</strong>
            {historyTotals.workers}
          </span>
        </div>
        <div className="responsive-table attendance-history-list">
          {historyGroups.length === 0 && !loading ? <EmptyState title="Sin historial" description="No hay jornadas en el periodo seleccionado." /> : null}
          {historyGroups.map((group) => (
            <article className="table-row record-card attendance-history-card" key={group.key}>
              <div className="record-main">
                <p className="record-label">Periodo</p>
                <strong>{group.label}</strong>
              </div>
              <div className="record-field highlight">
                <span>Horas trabajadas</span>
                <strong>{formatWorkDuration(group.workedSeconds)}</strong>
              </div>
              <div className="record-field">
                <span>Descanso</span>
                <strong>{formatWorkDuration(group.breakSeconds)}</strong>
              </div>
              <div className="record-field">
                <span>Jornadas</span>
                <strong>{group.entries}</strong>
              </div>
              <div className="record-field">
                <span>Trabajadores</span>
                <strong>{group.workers.size}</strong>
              </div>
            </article>
          ))}
        </div>
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
            const exceeded = Boolean(entry.requiresAdminReview || entry.exceededMaxDaily || live.workedSeconds > Number(entry.maxDailySeconds || 0));
            const canReview = Boolean(entry.clockOut) && !["active", "on_break", "approved", "rejected", "cancelled"].includes(entry.status);
            return (
              <article className="table-row record-card attendance-record-card" key={entry.timeEntryId}>
                <div className="record-main">
                  <div>
                    <p className="record-label">Trabajador</p>
                    <strong>{entry.workerName}</strong>
                    <span className="activity-meta">{entry.jobTitle || "Sin obra asignada"}</span>
                  </div>
                  <div className="record-badges">
                    <StatusBadge label={statusLabels[entry.status]} tone={statusTone[entry.status]} />
                    <StatusBadge label={locationLabel(entry)} tone={entry.locationStatus === "outside_radius" ? "danger" : entry.locationStatus === "inside_radius" ? "success" : "warning"} />
                    {exceeded ? <StatusBadge label="Requiere revision" tone="warning" /> : null}
                  </div>
                </div>

                <div className="record-field">
                  <span>Inicio de jornada</span>
                  <strong>{formatDateTime(entry.clockIn)}</strong>
                </div>
                <div className="record-field">
                  <span>Fin de jornada</span>
                  <strong>{entry.clockOut ? formatDateTime(entry.clockOut) : "Jornada abierta"}</strong>
                </div>
                <div className="record-field highlight">
                  <span>{isLive ? "Contador trabajado hoy" : "Horas trabajadas"}</span>
                  <strong>{isLive ? formatClockDuration(live.workedSeconds) : `${formatHours(live.workedSeconds)} h`}</strong>
                  {isLive ? <span className="activity-meta">Estimado en vivo desde datos oficiales · sincroniza cada 60 s</span> : null}
                </div>
                <div className="record-field">
                  <span>Tiempo pagable automatico</span>
                  <strong>{formatWorkDuration(live.payableSeconds)}</strong>
                  <span className="activity-meta">Maximo diario: {formatWorkDuration(entry.maxDailySeconds || 0)}</span>
                </div>
                <div className="record-field">
                  <span>Descanso</span>
                  <strong>{isLive ? formatWorkDuration(live.breakSeconds) : `${formatHours(live.breakSeconds)} h`}</strong>
                  <span className="activity-meta">{entry.payrollStatus === "paid" ? "Pagada" : entry.payrollStatus === "excluded" ? "Excluida" : "Por pagar"}</span>
                  {entry.cancelReason ? <span className="activity-meta">Motivo: {entry.cancelReason}</span> : null}
                </div>
                {entry.status === "approved" ? (
                  <div className="record-actions">
                    <span className="review-state-button success">
                      <CheckCircle2 size={16} />
                      Aprobada
                    </span>
                  </div>
                ) : entry.status === "rejected" ? (
                  <div className="record-actions">
                    <span className="review-state-button danger">
                      <XCircle size={16} />
                      Rechazada
                    </span>
                  </div>
                ) : (
                  <div className="segmented-actions record-actions">
                    <Button variant="secondary" type="button" icon={<CheckCircle2 size={16} />} onClick={() => setReviewIntent({ entry, status: "approved" })} disabled={saving || !canReview}>
                      Aprobar
                    </Button>
                    <Button variant="secondary" type="button" icon={<XCircle size={16} />} onClick={() => setReviewIntent({ entry, status: "rejected" })} disabled={saving || !canReview}>
                      Rechazar
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <BasicModal title={reviewIntent?.status === "approved" ? "Confirmar aprobacion" : "Confirmar rechazo"} open={Boolean(reviewIntent)} onClose={() => setReviewIntent(null)} footer={null}>
        <div className="activity-list">
          <p className="login-security-note">
            {reviewIntent?.status === "approved"
              ? "La jornada quedara aprobada para control interno y procesos relacionados. El registro no se elimina."
              : "La jornada quedara rechazada para revision interna. El registro se conserva en el historial."}
          </p>
          {reviewIntent ? (
            <div className="compact-fact-grid">
              <span>
                <strong>Trabajador</strong>
                {reviewIntent.entry.workerName}
              </span>
              <span>
                <strong>Inicio</strong>
                {formatDateTime(reviewIntent.entry.clockIn)}
              </span>
              <span>
                <strong>Horas / pagable</strong>
                {formatHours(calculateEntryLiveSeconds(reviewIntent.entry, now, attendanceLoadedAt).workedSeconds)} h / {formatHours(calculateEntryLiveSeconds(reviewIntent.entry, now, attendanceLoadedAt).payableSeconds)} h
              </span>
            </div>
          ) : null}
        </div>
        <div className="segmented-actions modal-form-actions">
          <Button variant={reviewIntent?.status === "rejected" ? "danger" : "primary"} type="button" onClick={() => void review()} disabled={saving}>
            {reviewIntent?.status === "approved" ? "Si, aprobar jornada" : "Si, rechazar jornada"}
          </Button>
          <Button variant="secondary" type="button" onClick={() => setReviewIntent(null)} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </BasicModal>
    </section>
  );
}

function buildWorkerOptions(entries: TimeEntry[]) {
  const workers = new Map<string, string>();
  for (const entry of entries) {
    if (entry.workerId && entry.workerName) {
      workers.set(entry.workerId, entry.workerName);
    }
  }
  return Array.from(workers, ([workerId, name]) => ({ workerId, name })).sort((a, b) => a.name.localeCompare(b.name));
}

function buildHistoryGroups(entries: TimeEntry[], mode: HistoryGroupMode, nowMs: number, attendanceLoadedAt: number) {
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      workedSeconds: number;
      breakSeconds: number;
      entries: number;
      workers: Set<string>;
    }
  >();

  for (const entry of entries) {
    const date = new Date(entry.clockIn);
    if (!Number.isFinite(date.getTime())) {
      continue;
    }
    const group = historyGroupForDate(date, mode);
    const current =
      groups.get(group.key) ||
      groups.set(group.key, {
        key: group.key,
        label: group.label,
        workedSeconds: 0,
        breakSeconds: 0,
        entries: 0,
        workers: new Set<string>(),
      }).get(group.key)!;
    const live = calculateEntryLiveSeconds(entry, nowMs, attendanceLoadedAt);
    current.workedSeconds += live.workedSeconds;
    current.breakSeconds += live.breakSeconds;
    current.entries += 1;
    if (entry.workerId) {
      current.workers.add(entry.workerId);
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.key.localeCompare(a.key));
}

function sumHistoryGroups(groups: ReturnType<typeof buildHistoryGroups>) {
  const workerIds = new Set<string>();
  return groups.reduce(
    (acc, group) => {
      acc.workedSeconds += group.workedSeconds;
      acc.breakSeconds += group.breakSeconds;
      acc.entries += group.entries;
      group.workers.forEach((workerId) => workerIds.add(workerId));
      acc.workers = workerIds.size;
      return acc;
    },
    { workedSeconds: 0, breakSeconds: 0, entries: 0, workers: 0 },
  );
}

function historyGroupForDate(date: Date, mode: HistoryGroupMode) {
  if (mode === "year") {
    const year = date.getFullYear();
    return { key: String(year), label: String(year) };
  }
  if (mode === "month") {
    const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
    return { key, label: date.toLocaleDateString(undefined, { month: "long", year: "numeric" }) };
  }
  if (mode === "biweekly") {
    const startDay = date.getDate() <= 15 ? 1 : 16;
    const endDay = startDay === 1 ? 15 : new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const start = new Date(date.getFullYear(), date.getMonth(), startDay);
    const end = new Date(date.getFullYear(), date.getMonth(), endDay);
    const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(startDay)}`;
    return { key, label: `${formatShortDate(start)} a ${formatShortDate(end)}` };
  }
  if (mode === "week") {
    const start = new Date(date);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { key: dateToInputValue(start), label: `${formatShortDate(start)} a ${formatShortDate(end)}` };
  }
  return { key: dateToInputValue(date), label: formatShortDate(date) };
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

function formatShortDate(value: Date) {
  return value.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function todayDateInput() {
  return dateToInputValue(new Date());
}

function monthStartDateInput() {
  const now = new Date();
  return dateToInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
}

function dateToInputValue(value: Date) {
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
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
    const workedSeconds = Math.max(0, Number(entry.totalSeconds || 0));
    return {
      workedSeconds,
      payableSeconds: Math.max(0, Number(entry.payableSeconds ?? Math.min(workedSeconds, Number(entry.maxDailySeconds || workedSeconds)))),
      breakSeconds,
    };
  }

  const grossSeconds = Math.max(0, Math.floor((safeClockOutMs - clockInMs) / 1000));
  const workedSeconds = Math.max(0, grossSeconds - breakSeconds);
  const maxDailySeconds = Number(entry.maxDailySeconds || workedSeconds);
  return {
    workedSeconds,
    payableSeconds: Math.min(workedSeconds, maxDailySeconds),
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
