import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CalendarDays, FileText, MapPin } from "lucide-react";
import { clients } from "../../crm/mock-data/crmData";
import { estimates } from "../../estimates/mock-data/estimatesData";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { jobs, type JobStatus } from "../mock-data/jobsData";

const jobTone: Record<JobStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Planificada: "neutral",
  "En progreso": "success",
  "En pausa": "warning",
  "Pendiente de cambio": "danger",
  "Cerrada visualmente": "info",
};

type JobDetailPageProps = {
  basePath: "/admin/obras" | "/manager/obras";
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function JobDetailPage({ basePath, roleLabel }: JobDetailPageProps) {
  const { jobId } = useParams();
  const job = jobs.find((item) => item.jobId === jobId);

  if (!job) {
    return (
      <>
        <PageHeader eyebrow={roleLabel} title="Obra no encontrada" />
        <EmptyState title="Ficha no disponible" description="El identificador no existe en los datos simulados." />
      </>
    );
  }

  const client = clients.find((item) => item.clientId === job.clientId);
  const estimate = estimates.find((item) => item.estimateId === job.estimateId);

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - Ficha V0.4`}
        title={`${job.jobNumber} - ${job.title}`}
        description="Ficha visual de obra con fases, tareas, equipo, documentos, cambios e incidencias."
        actions={
          <Link className="button button-secondary" to={basePath}>
            <ArrowLeft size={18} />
            Volver
          </Link>
        }
      />

      <section className="grid two-column">
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Resumen de obra</h2>
            <StatusBadge label={job.status} tone={jobTone[job.status]} />
          </div>
          <div className="grid proof-grid">
            <VisualField label="jobId" value={job.jobId} />
            <VisualField label="Cliente" value={client?.name || job.clientId} />
            <VisualField label="Cotizacion origen" value={estimate?.estimateNumber || job.estimateId} />
            <VisualField label="Supervisor" value={job.supervisor} />
            <VisualField label="Ventana visual" value={job.scheduledWindow} />
            <VisualField label="Presupuesto visual" value={job.budgetVisual} />
          </div>
          <p className="activity-meta" style={{ marginTop: 14 }}>
            {job.scope}
          </p>
        </div>

        <div className="worker-card">
          <div className="card-title-row">
            <h2 className="card-title">Ubicacion</h2>
            <MapPin size={20} />
          </div>
          <VisualField label="Direccion" value={job.address} />
          <div className="map-placeholder" style={{ marginTop: 14 }}>
            <MapPin size={34} />
            Placeholder sin GPS ni mapa externo.
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <h2 className="card-title">Fases y cronograma visual</h2>
          <CalendarDays size={20} />
        </div>
        <div className="job-phase-grid">
          {job.phases.map((phase) => (
            <article className="job-phase-card" key={phase.phaseId}>
              <div className="card-title-row">
                <h3 className="alert-title">{phase.title}</h3>
                <StatusBadge label={phase.status} tone={phase.status === "Completada" ? "success" : phase.status === "Activa" ? "info" : "neutral"} />
              </div>
              <p className="activity-meta">{phase.window}</p>
              <div className="bar-track" style={{ marginTop: 10 }}>
                <span className="bar-fill" style={{ width: phase.progress }} />
              </div>
              <p className="activity-meta">{phase.progress} visual</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Tareas</h2>
            <StatusBadge label={`${job.tasks.length} tareas`} tone="info" />
          </div>
          <div className="responsive-table">
            {job.tasks.map((task) => (
              <article className="table-row task-row-grid" key={task.taskId}>
                <strong>{task.title}</strong>
                <span>{task.owner}</span>
                <StatusBadge label={task.status} tone={task.status === "Bloqueada" ? "danger" : task.status === "Completada" ? "success" : "neutral"} />
              </article>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Equipo asignado</h2>
            <StatusBadge label="Visual" tone="neutral" />
          </div>
          <div className="grid status-grid">
            {job.team.map((member) => (
              <StatusBadge key={member} label={member} tone="info" />
            ))}
          </div>
        </div>
      </section>

      <section className="grid proof-grid" style={{ marginTop: 18 }}>
        <article className="worker-card">
          <div className="card-title-row">
            <h2 className="card-title">Documentos</h2>
            <FileText size={20} />
          </div>
          <ul className="activity-list">
            {job.documents.map((document) => (
              <li className="activity-meta" key={document}>
                {document}
              </li>
            ))}
          </ul>
        </article>
        <article className="worker-card">
          <div className="card-title-row">
            <h2 className="card-title">Cambios e incidencias</h2>
            <AlertTriangle size={20} />
          </div>
          <ul className="activity-list">
            {[...job.changeRequests, ...job.incidents].length > 0 ? (
              [...job.changeRequests, ...job.incidents].map((item) => (
                <li className="activity-meta" key={item}>
                  {item}
                </li>
              ))
            ) : (
              <li className="activity-meta">Sin cambios ni incidencias visuales.</li>
            )}
          </ul>
        </article>
      </section>
    </>
  );
}
