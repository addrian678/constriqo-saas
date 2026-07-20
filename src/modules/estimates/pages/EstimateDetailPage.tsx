import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, FileText } from "lucide-react";
import { clients } from "../../crm/mock-data/crmData";
import { ActivityList } from "../../../shared/components/ActivityList";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { estimates, type EstimateStatus } from "../mock-data/estimatesData";

const estimateTone: Record<EstimateStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Borrador: "neutral",
  Enviada: "info",
  "En revision": "warning",
  "Aprobada visualmente": "success",
  Rechazada: "danger",
};

type EstimateDetailPageProps = {
  basePath: "/admin/cotizaciones" | "/manager/cotizaciones";
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function EstimateDetailPage({ basePath, roleLabel }: EstimateDetailPageProps) {
  const { estimateId } = useParams();
  const estimate = estimates.find((item) => item.estimateId === estimateId);

  if (!estimate) {
    return (
      <>
        <PageHeader eyebrow={roleLabel} title="Cotizacion no encontrada" />
        <EmptyState title="Detalle no disponible" description="El identificador no existe en los datos simulados." />
      </>
    );
  }

  const client = clients.find((item) => item.clientId === estimate.clientId);
  const activity = estimate.activity.map((item) => ({
    title: item.title,
    meta: item.description,
    status: item.date,
    tone: "info" as const,
  }));

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - Detalle V0.3`}
        title={`${estimate.estimateNumber} - ${estimate.title}`}
        description="Detalle visual con partidas, versiones, actividad, idioma y vista previa sin generar documentos reales."
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
            <h2 className="card-title">Resumen</h2>
            <StatusBadge label={estimate.status} tone={estimateTone[estimate.status]} />
          </div>
          <div className="grid proof-grid">
            <VisualField label="estimateId" value={estimate.estimateId} />
            <VisualField label="Cliente" value={client?.name || estimate.clientId} />
            <VisualField label="Idioma" value={estimate.language} />
            <VisualField label="Valida hasta" value={estimate.validUntil} />
            <VisualField label="Responsable" value={estimate.responsibleName} />
            <VisualField label="Total simulado" value={estimate.total} />
          </div>
          <div className="worker-actions" style={{ marginTop: 16 }}>
            <Button icon={<CheckCircle2 size={18} />}>Aprobar visualmente</Button>
            <Button variant="secondary" icon={<FileText size={18} />}>
              Vista previa
            </Button>
          </div>
          <p className="activity-meta" style={{ marginTop: 12 }}>
            Aprobar no crea una obra. Solo representa el aviso de funcion futura definido por el plan maestro.
          </p>
        </div>

        <div className="document-preview">
          <div className="preview-paper">
            <p className="eyebrow">Preview</p>
            <h2>{estimate.estimateNumber}</h2>
            <p>{client?.name}</p>
            <hr />
            <p>{estimate.scope}</p>
            <strong>{estimate.total}</strong>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <h2 className="card-title">Secciones y partidas</h2>
          <StatusBadge label="Totales simulados" tone="neutral" />
        </div>
        <div className="responsive-table">
          <div className="table-header estimate-items-grid">
            <span>Seccion</span>
            <span>Descripcion</span>
            <span>Cantidad</span>
            <span>Unidad</span>
            <span>Importe</span>
          </div>
          {estimate.items.map((item) => (
            <article className="table-row estimate-items-grid" key={item.itemId}>
              <strong>{item.section}</strong>
              <span>{item.description}</span>
              <span>{item.quantity}</span>
              <span>{item.unit}</span>
              <strong>{item.amount}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Alcance, exclusiones y condiciones</h2>
          </div>
          <p className="activity-meta">{estimate.scope}</p>
          <div className="grid proof-grid" style={{ marginTop: 14 }}>
            <div>
              <h3 className="alert-title">Exclusiones</h3>
              <ul className="activity-list">
                {estimate.exclusions.map((item) => (
                  <li className="activity-meta" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="alert-title">Condiciones</h3>
              <ul className="activity-list">
                {estimate.conditions.map((item) => (
                  <li className="activity-meta" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Actividad y versiones</h2>
            <StatusBadge label={`${estimate.versions.length} versiones`} tone="info" />
          </div>
          <ActivityList items={activity} />
          <div className="grid" style={{ marginTop: 14 }}>
            {estimate.versions.map((version) => (
              <StatusBadge key={version} label={version} tone="neutral" />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
