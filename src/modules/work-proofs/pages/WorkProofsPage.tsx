import { AlertTriangle, CheckCircle2, Image, PackageCheck } from "lucide-react";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { jobs } from "../../jobs/mock-data/jobsData";
import { workforceMembers } from "../../workforce/mock-data/workforceData";
import { fieldIncidents, workProofs } from "../mock-data/workProofsData";

export function WorkProofsPage() {
  const worker = workforceMembers[0];
  const proof = workProofs[0];
  const job = jobs.find((item) => item.jobId === proof.jobId);
  const workerIncidents = fieldIncidents.filter((incident) => incident.workerId === worker.workerId || incident.jobId === proof.jobId);

  return (
    <>
      <PageHeader
        eyebrow="Trabajador - V0.7"
        title="Pruebas de trabajo"
        description="Checklist, evidencias, materiales, observaciones e incidencias. Sin camara, archivos, firma ni envio real."
      />
      <section className="grid two-column">
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Detalle del trabajo</h2>
            <StatusBadge label={proof.status} tone="warning" />
          </div>
          <div className="grid proof-grid">
            <VisualField label="Trabajo" value={job?.title || proof.jobId} />
            <VisualField label="Tarea" value={proof.task} />
            <VisualField label="Trabajador" value={worker.name} />
            <VisualField label="Fecha" value={proof.date} />
            <VisualField label="Estado" value={proof.status} />
            <VisualField label="Confirmacion" value="Pendiente de revision visual" />
          </div>
          <div className="grid proof-grid" style={{ marginTop: 16 }}>
            <div className="evidence-box">
              <Image size={28} />
              {proof.initialEvidence}
            </div>
            <div className="evidence-box">
              <Image size={28} />
              {proof.finalEvidence}
            </div>
          </div>
        </div>
        <div className="grid">
          <article className="worker-card">
            <div className="card-title-row">
              <h2 className="card-title">Checklist</h2>
              <CheckCircle2 size={20} />
            </div>
            <ul className="activity-list">
              {proof.checklist.map((item) => (
                <li className="activity-item" key={item.checklistItemId}>
                  <span className="activity-icon">
                    <CheckCircle2 size={17} />
                  </span>
                  <p className="activity-title">{item.label}</p>
                  <StatusBadge label={item.status} tone={item.status === "Completado" ? "success" : "warning"} />
                </li>
              ))}
            </ul>
          </article>
          <article className="worker-card">
            <div className="card-title-row">
              <h2 className="card-title">Materiales utilizados</h2>
              <PackageCheck size={20} />
            </div>
            <div className="grid">
              {proof.materials.map((material) => (
                <div className="table-row material-row-grid" key={material.materialId}>
                  <strong>{material.name}</strong>
                  <span>{material.quantity}</span>
                  <span className="activity-meta">{material.note}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <article className="worker-card">
          <div className="card-title-row">
            <h2 className="card-title">Observaciones</h2>
            <PackageCheck size={20} />
          </div>
          <p className="activity-meta">{proof.observations}</p>
        </article>
        <article className="worker-card">
          <div className="card-title-row">
            <h2 className="card-title">Incidencias relacionadas</h2>
            <AlertTriangle size={20} />
          </div>
          <div className="grid">
            {workerIncidents.map((incident) => (
              <StatusBadge key={incident.incidentId} label={`${incident.title} - ${incident.status}`} tone="danger" />
            ))}
          </div>
        </article>
      </section>
    </>
  );
}
