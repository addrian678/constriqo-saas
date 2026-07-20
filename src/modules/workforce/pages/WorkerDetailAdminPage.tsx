import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BriefcaseBusiness, FileText, ShieldCheck } from "lucide-react";
import { jobs } from "../../jobs/mock-data/jobsData";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { workforceMembers, type WorkerStatus } from "../mock-data/workforceData";

const workerTone: Record<WorkerStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Activo: "success",
  Disponible: "info",
  Asignado: "warning",
  "En descanso": "neutral",
  "Documento pendiente": "danger",
};

type WorkerDetailAdminPageProps = {
  basePath: "/admin/trabajadores" | "/manager/trabajadores";
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function WorkerDetailAdminPage({ basePath, roleLabel }: WorkerDetailAdminPageProps) {
  const { workerId } = useParams();
  const member = workforceMembers.find((item) => item.workerId === workerId);

  if (!member) {
    return (
      <>
        <PageHeader eyebrow={roleLabel} title="Trabajador no encontrado" />
        <EmptyState title="Ficha no disponible" description="El identificador no existe en los datos simulados." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - Ficha V0.5`}
        title={member.name}
        description="Ficha visual de trabajador con oficio, capacidades, documentos y asignaciones."
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
            <h2 className="card-title">Perfil laboral</h2>
            <StatusBadge label={member.status} tone={workerTone[member.status]} />
          </div>
          <div className="grid proof-grid">
            <VisualField label="workerId" value={member.workerId} />
            <VisualField label="Rol" value={member.role} />
            <VisualField label="Oficio" value={member.trade} />
            <VisualField label="Disponibilidad" value={member.availability} />
            <VisualField label="Telefono" value={member.phone} />
            <VisualField label="Correo" value={member.email} />
          </div>
          <p className="activity-meta" style={{ marginTop: 14 }}>
            {member.notes}
          </p>
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Capacidades</h2>
            <ShieldCheck size={20} />
          </div>
          <div className="grid status-grid">
            {member.skills.map((skill) => (
              <StatusBadge key={skill} label={skill} tone="info" />
            ))}
            {member.certifications.map((certification) => (
              <StatusBadge key={certification} label={certification} tone="success" />
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <VisualField label="Coste visual" value={`${member.hourlyCostVisual} - sin nomina real`} />
          </div>
        </div>
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Asignaciones</h2>
            <BriefcaseBusiness size={20} />
          </div>
          <div className="responsive-table">
            {member.assignments.map((assignment) => {
              const job = jobs.find((item) => item.jobId === assignment.jobId);
              return (
                <article className="table-row worker-assignment-grid" key={assignment.assignmentId}>
                  <div>
                    <strong>{job?.title || assignment.jobId}</strong>
                    <p className="activity-meta">{assignment.window}</p>
                  </div>
                  <span>{assignment.role}</span>
                  <StatusBadge label={assignment.status} tone={assignment.status === "Activa" ? "success" : "neutral"} />
                </article>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Documentos</h2>
            <FileText size={20} />
          </div>
          <div className="responsive-table">
            {member.documents.map((document) => (
              <article className="table-row worker-document-grid" key={document.documentId}>
                <strong>{document.title}</strong>
                <StatusBadge
                  label={document.status}
                  tone={document.status === "Vigente" ? "success" : document.status === "Por vencer" ? "warning" : "danger"}
                />
                <span>{document.expires}</span>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
