import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, Search } from "lucide-react";
import { jobs } from "../../jobs/mock-data/jobsData";
import { workforceMembers } from "../../workforce/mock-data/workforceData";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { attendanceReviewQueue, timeEntries, type TimeEntryStatus } from "../mock-data/attendanceData";

const entryTone: Record<TimeEntryStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  "Jornada no iniciada": "neutral",
  "Jornada activa": "success",
  "En descanso": "warning",
  "Jornada terminada": "info",
  "Pendiente de revision": "warning",
  Excepcion: "danger",
};

type AttendanceReviewPageProps = {
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function AttendanceReviewPage({ roleLabel }: AttendanceReviewPageProps) {
  const [query, setQuery] = useState("");
  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return timeEntries.filter((entry) => {
      const worker = workforceMembers.find((member) => member.workerId === entry.workerId);
      const job = jobs.find((item) => item.jobId === entry.jobId);
      return (
        !normalizedQuery ||
        [worker?.name || "", job?.title || "", entry.status, entry.perimeterStatus].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        )
      );
    });
  }, [query]);

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - V0.6`}
        title="Control horario"
        description="Revision visual de jornadas, descansos, excepciones, perimetro y aprobacion. Sin hora de servidor real ni GPS."
      />

      <section className="grid stats-grid">
        <StatCard label="Entradas del dia" value="4" note="Registros simulados" tone="info" icon={Clock3} />
        <StatCard
          label="Pendientes"
          value={String(attendanceReviewQueue.length)}
          note="Revision visual"
          tone="warning"
          icon={AlertTriangle}
        />
        <StatCard label="Aprobadas" value="1" note="Sin auditoria real" tone="positive" icon={CheckCircle2} />
        <StatCard label="Horas visuales" value="23.9 h" note="No es calculo laboral real" tone="danger" icon={CalendarClock} />
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Bandeja de revision</h2>
            <p className="activity-meta">Aprobar o ajustar queda representado visualmente; no cambia datos ni genera auditoria real.</p>
          </div>
          <StatusBadge label="V0.6 visual" tone="info" />
        </div>
        <label className="search-box crm-search">
          <Search size={18} />
          <input
            aria-label="Buscar registros de asistencia"
            placeholder="Buscar por trabajador, obra o estado"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        {filteredEntries.length > 0 ? (
          <div className="responsive-table" style={{ marginTop: 16 }}>
            <div className="table-header attendance-table-grid">
              <span>Trabajador</span>
              <span>Obra</span>
              <span>Jornada</span>
              <span>Perimetro</span>
              <span>Revision</span>
            </div>
            {filteredEntries.map((entry) => {
              const worker = workforceMembers.find((member) => member.workerId === entry.workerId);
              const job = jobs.find((item) => item.jobId === entry.jobId);
              return (
                <article className="table-row attendance-table-grid" key={entry.timeEntryId}>
                  <div>
                    <strong>{worker?.name}</strong>
                    <p className="activity-meta">{entry.date}</p>
                  </div>
                  <div>
                    <strong>{job?.title}</strong>
                    <p className="activity-meta">{entry.expectedSchedule}</p>
                  </div>
                  <StatusBadge label={entry.status} tone={entryTone[entry.status]} />
                  <StatusBadge label={entry.perimeterStatus} tone={entry.perimeterStatus === "Dentro del perimetro" ? "success" : "warning"} />
                  <StatusBadge label={entry.reviewStatus} tone={entry.reviewStatus === "Requiere ajuste" ? "danger" : "neutral"} />
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Sin registros" description="No hay registros para la busqueda actual." />
        )}
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Excepcion seleccionada</h2>
            <StatusBadge label="Visual" tone="warning" />
          </div>
          <div className="grid proof-grid">
            <VisualField label="Motivo" value="Ubicacion imprecisa o registro sin conexion" />
            <VisualField label="Accion futura" value="Solicitar ajuste, aprobar o rechazar" />
            <VisualField label="Auditoria" value="Pendiente de F1/F2" />
            <VisualField label="Permisos" value="Servidor en fase funcional" />
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">Politicas visuales</h2>
          <p className="activity-meta">
            No hay seguimiento GPS continuo. El perimetro, QR, NFC, foto y revision se muestran como estados futuros configurables.
          </p>
        </div>
      </section>
    </>
  );
}
