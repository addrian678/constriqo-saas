import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, FileText, WalletCards } from "lucide-react";
import { visualDocuments } from "../../documents/mock-data/documentsData";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { assets, liabilities, type LiabilityStatus, type ObligationStatus } from "../mock-data/assetsData";

const liabilityTone: Record<LiabilityStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  "Al dia": "success",
  "Vence pronto": "warning",
  Vencida: "danger",
  "Cerrada visualmente": "neutral",
};

const obligationTone: Record<ObligationStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Pendiente: "warning",
  "Cubierta visual": "success",
  Revisar: "danger",
};

type LiabilityDetailPageProps = {
  basePath: "/admin/pasivos";
  roleLabel: "Administrador";
};

export function LiabilityDetailPage({ basePath, roleLabel }: LiabilityDetailPageProps) {
  const { liabilityId } = useParams();
  const liability = liabilities.find((item) => item.liabilityId === liabilityId);

  if (!liability) {
    return (
      <>
        <PageHeader eyebrow={roleLabel} title="Pasivo no encontrado" />
        <EmptyState title="Detalle no disponible" description="El identificador no existe en los datos simulados." />
      </>
    );
  }

  const relatedAsset = assets.find((asset) => asset.assetId === liability.relatedAssetId);
  const documents = visualDocuments.filter((document) => liability.documentIds.includes(document.documentId));

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - Detalle V0.12`}
        title={`${liability.reference} - ${liability.lender}`}
        description="Detalle visual de prestamo, cuota, vencimiento y documentos asociados. Sin pagos, amortizacion ni asiento contable."
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
            <h2 className="card-title">Resumen del pasivo</h2>
            <StatusBadge label={liability.status} tone={liabilityTone[liability.status]} />
          </div>
          <div className="grid proof-grid">
            <VisualField label="liabilityId" value={liability.liabilityId} />
            <VisualField label="Tipo" value={liability.type} />
            <VisualField label="Entidad" value={liability.lender} />
            <VisualField label="Principal visual" value={liability.principalVisual} />
            <VisualField label="Saldo visual" value={liability.balanceVisual} />
            <VisualField label="Cuota" value={liability.installmentVisual} />
            <VisualField label="Proximo vencimiento" value={liability.nextDueDate} />
            <VisualField label="Activo relacionado" value={relatedAsset?.code || "No aplica"} />
          </div>
          <p className="activity-meta" style={{ marginTop: 14 }}>
            {liability.notes}
          </p>
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Control financiero visual</h2>
            <WalletCards size={20} />
          </div>
          <div className="grid proof-grid">
            <VisualField label="Pago" value="Deshabilitado en V0.12" />
            <VisualField label="Amortizacion" value="No calculada" />
            <VisualField label="Contabilidad" value="Sin asiento real" />
            <VisualField label="Notificacion" value="Alerta visual solamente" />
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <h2 className="card-title">Cuotas y vencimientos</h2>
          <CalendarClock size={20} />
        </div>
        <div className="responsive-table">
          <div className="table-header schedule-table-grid">
            <span>Fecha</span>
            <span>Importe</span>
            <span>Estado</span>
          </div>
          {liability.schedule.map((item) => (
            <article className="table-row schedule-table-grid" key={item.scheduleId}>
              <span>{item.date}</span>
              <strong>{item.amount}</strong>
              <StatusBadge label={item.status} tone={obligationTone[item.status]} />
            </article>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <h2 className="card-title">Documentos vinculados</h2>
          <FileText size={20} />
        </div>
        <div className="grid">
          {documents.map((document) => (
            <article className="alert-card" key={document.documentId}>
              <div className="alert-heading">
                <h3 className="alert-title">{document.title}</h3>
                <StatusBadge label={document.status} tone={document.status === "Por vencer" ? "warning" : "neutral"} />
              </div>
              <p className="alert-text">{document.folder} - {document.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="worker-card" style={{ marginTop: 18 }}>
        <h2 className="card-title">Limites de fase</h2>
        <p className="activity-meta">
          Pagos, amortizacion, intereses, conciliacion, contratos reales, adjuntos y recordatorios automaticos quedan fuera de V0.12.
        </p>
      </section>
    </>
  );
}
