import { useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, FileWarning, Search } from "lucide-react";
import { jobs } from "../../jobs/mock-data/jobsData";
import { workforceMembers } from "../../workforce/mock-data/workforceData";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { dailyReports, fieldIncidents, type FieldReportStatus, type IncidentSeverity } from "../mock-data/workProofsData";

const reportTone: Record<FieldReportStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Borrador: "neutral",
  Enviado: "info",
  "En revision": "warning",
  "Aprobado visualmente": "success",
  "Requiere ajuste": "danger",
};

const severityTone: Record<IncidentSeverity, "warning" | "danger" | "neutral"> = {
  Baja: "neutral",
  Media: "warning",
  Alta: "danger",
};

type FieldReportsPageProps = {
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function FieldReportsPage({ roleLabel }: FieldReportsPageProps) {
  const [query, setQuery] = useState("");

  const filteredReports = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return dailyReports.filter((report) => {
      const job = jobs.find((item) => item.jobId === report.jobId);
      return (
        !normalizedQuery ||
        [job?.title || "", report.status, report.progressSummary, report.date].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        )
      );
    });
  }, [query]);

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - V0.7`}
        title="Partes diarios"
        description="Revision visual de partes, checklists, evidencias, materiales e incidencias. Sin archivos, firma ni almacenamiento real."
      />

      <section className="grid stats-grid">
        <StatCard label="Partes de hoy" value={String(dailyReports.length)} note="Mock data local" tone="info" icon={ClipboardCheck} />
        <StatCard label="En revision" value="1" note="Sin aprobacion real" tone="warning" icon={FileWarning} />
        <StatCard label="Incidencias" value={String(fieldIncidents.length)} note="Visuales" tone="danger" icon={AlertTriangle} />
        <StatCard label="Evidencias" value="4" note="Placeholders" tone="positive" icon={ClipboardCheck} />
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Bandeja de partes</h2>
            <p className="activity-meta">Aprobar, solicitar ajuste o cerrar incidencia queda simulado en esta fase.</p>
          </div>
          <StatusBadge label="V0.7 visual" tone="info" />
        </div>
        <label className="search-box crm-search">
          <Search size={18} />
          <input
            aria-label="Buscar partes diarios"
            placeholder="Buscar por obra, estado o resumen"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        {filteredReports.length > 0 ? (
          <div className="responsive-table" style={{ marginTop: 16 }}>
            <div className="table-header field-report-grid">
              <span>Parte</span>
              <span>Obra</span>
              <span>Equipo</span>
              <span>Estado</span>
              <span>Incidencias</span>
            </div>
            {filteredReports.map((report) => {
              const job = jobs.find((item) => item.jobId === report.jobId);
              return (
                <article className="table-row field-report-grid" key={report.reportId}>
                  <div>
                    <strong>{report.date}</strong>
                    <p className="activity-meta">{report.progressSummary}</p>
                  </div>
                  <div>
                    <strong>{job?.title}</strong>
                    <p className="activity-meta">{report.weatherVisual}</p>
                  </div>
                  <span>{report.crew.join(", ")}</span>
                  <StatusBadge label={report.status} tone={reportTone[report.status]} />
                  <StatusBadge label={`${report.incidents.length} incidencia(s)`} tone={report.incidents.length ? "danger" : "neutral"} />
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Sin partes" description="No hay resultados para la busqueda actual." />
        )}
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Incidencias abiertas</h2>
            <StatusBadge label="Revision visual" tone="warning" />
          </div>
          <div className="grid">
            {fieldIncidents.map((incident) => {
              const worker = workforceMembers.find((member) => member.workerId === incident.workerId);
              return (
                <article className="alert-card" key={incident.incidentId}>
                  <div className="alert-heading">
                    <h3 className="alert-title">{incident.title}</h3>
                    <StatusBadge label={incident.severity} tone={severityTone[incident.severity]} />
                  </div>
                  <p className="alert-text">{incident.description}</p>
                  <p className="activity-meta">{worker?.name} - {incident.status}</p>
                </article>
              );
            })}
          </div>
        </div>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Revision seleccionada</h2>
            <StatusBadge label="Sin firma real" tone="neutral" />
          </div>
          <div className="grid proof-grid">
            <VisualField label="Accion futura" value="Aprobar, devolver o comentar" />
            <VisualField label="Firma" value="Placeholder visual" />
            <VisualField label="Archivos" value="No hay storage ni subida" />
            <VisualField label="Auditoria" value="Pendiente F1/F2" />
          </div>
        </div>
      </section>
    </>
  );
}
