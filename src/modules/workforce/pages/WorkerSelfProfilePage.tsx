import { BriefcaseBusiness, FileText, ShieldCheck } from "lucide-react";
import { jobs } from "../../jobs/mock-data/jobsData";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { workforceMembers } from "../mock-data/workforceData";

export function WorkerSelfProfilePage() {
  const member = workforceMembers[0];

  return (
    <>
      <PageHeader
        eyebrow="Trabajador"
        title="Mi perfil"
        description="Vista limitada al propio trabajador. No muestra datos de otros trabajadores ni configuracion administrativa."
      />

      <section className="worker-card">
        <div className="card-title-row">
          <h2 className="card-title">{member.name}</h2>
          <StatusBadge label={member.status} tone="warning" />
        </div>
        <div className="grid proof-grid">
          <VisualField label="Rol" value={member.role} />
          <VisualField label="Oficio" value={member.trade} />
          <VisualField label="Telefono" value={member.phone} />
          <VisualField label="Correo" value={member.email} />
        </div>
      </section>

      <section className="grid proof-grid" style={{ marginTop: 14 }}>
        <article className="worker-card">
          <div className="card-title-row">
            <h2 className="card-title">Mis capacidades</h2>
            <ShieldCheck size={20} />
          </div>
          <div className="grid status-grid">
            {member.skills.map((skill) => (
              <StatusBadge key={skill} label={skill} tone="info" />
            ))}
          </div>
        </article>
        <article className="worker-card">
          <div className="card-title-row">
            <h2 className="card-title">Mis documentos</h2>
            <FileText size={20} />
          </div>
          <div className="grid">
            {member.documents.map((document) => (
              <StatusBadge
                key={document.documentId}
                label={`${document.title} - ${document.status}`}
                tone={document.status === "Vigente" ? "success" : "warning"}
              />
            ))}
          </div>
        </article>
      </section>

      <section className="worker-card" style={{ marginTop: 14 }}>
        <div className="card-title-row">
          <h2 className="card-title">Mis asignaciones</h2>
          <BriefcaseBusiness size={20} />
        </div>
        <div className="grid">
          {member.assignments.map((assignment) => {
            const job = jobs.find((item) => item.jobId === assignment.jobId);
            return (
              <article className="alert-card" key={assignment.assignmentId}>
                <div className="alert-heading">
                  <h3 className="alert-title">{job?.title || assignment.jobId}</h3>
                  <StatusBadge label={assignment.status} tone={assignment.status === "Activa" ? "success" : "neutral"} />
                </div>
                <p className="alert-text">
                  {assignment.role} - {assignment.window}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
