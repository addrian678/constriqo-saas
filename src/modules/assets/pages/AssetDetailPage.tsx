import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, ShieldCheck, Wrench } from "lucide-react";
import { visualDocuments } from "../../documents/mock-data/documentsData";
import { vendors } from "../../expenses/mock-data/expensesData";
import { jobs } from "../../jobs/mock-data/jobsData";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { assets, type AssetStatus, type MaintenanceStatus } from "../mock-data/assetsData";

const assetTone: Record<AssetStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Operativo: "success",
  "Mantenimiento programado": "warning",
  "Fuera de servicio": "danger",
  "Garantia por vencer": "info",
};

const maintenanceTone: Record<MaintenanceStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Programado: "warning",
  "Completado visual": "success",
  "Requiere revision": "danger",
};

type AssetDetailPageProps = {
  basePath: "/admin/activos";
  roleLabel: "Administrador";
};

export function AssetDetailPage({ basePath, roleLabel }: AssetDetailPageProps) {
  const { assetId } = useParams();
  const asset = assets.find((item) => item.assetId === assetId);

  if (!asset) {
    return (
      <>
        <PageHeader eyebrow={roleLabel} title="Activo no encontrado" />
        <EmptyState title="Detalle no disponible" description="El identificador no existe en los datos simulados." />
      </>
    );
  }

  const job = jobs.find((item) => item.jobId === asset.assignedJobId);
  const documents = visualDocuments.filter((document) => asset.documentIds.includes(document.documentId));

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - Detalle V0.12`}
        title={`${asset.code} - ${asset.name}`}
        description="Ficha visual de activo con responsable, ubicacion, depreciacion manual, mantenimiento y documentos relacionados."
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
            <h2 className="card-title">Resumen del activo</h2>
            <StatusBadge label={asset.status} tone={assetTone[asset.status]} />
          </div>
          <div className="grid proof-grid">
            <VisualField label="assetId" value={asset.assetId} />
            <VisualField label="Categoria" value={asset.category} />
            <VisualField label="Responsable" value={asset.custodian} />
            <VisualField label="Obra asignada" value={job?.jobNumber || asset.assignedJobId} />
            <VisualField label="Ubicacion" value={asset.location} />
            <VisualField label="Compra" value={asset.purchaseDate} />
            <VisualField label="Costo visual" value={asset.purchaseCostVisual} />
            <VisualField label="Valor en libros" value={asset.bookValueVisual} />
            <VisualField label="Depreciacion visual" value={asset.depreciationVisual} />
            <VisualField label="Garantia vence" value={asset.warrantyExpires} />
          </div>
          <p className="activity-meta" style={{ marginTop: 14 }}>
            {asset.notes}
          </p>
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Garantia y custodia</h2>
            <ShieldCheck size={20} />
          </div>
          <div className="grid proof-grid">
            <VisualField label="Estado garantia" value={asset.status === "Garantia por vencer" ? "Revisar pronto" : "Sin alerta critica"} />
            <VisualField label="Documento base" value={documents[0]?.title || "Sin documento visual"} />
            <VisualField label="Control fisico" value="Inventario visual" />
            <VisualField label="Depreciacion" value="Manual en V0.12" />
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <h2 className="card-title">Mantenimiento</h2>
          <Wrench size={20} />
        </div>
        <div className="responsive-table">
          <div className="table-header maintenance-table-grid">
            <span>Fecha</span>
            <span>Tipo</span>
            <span>Proveedor</span>
            <span>Estado</span>
          </div>
          {asset.maintenance.map((item) => {
            const vendor = vendors.find((vendorItem) => vendorItem.vendorId === item.vendorId);
            return (
              <article className="table-row maintenance-table-grid" key={item.maintenanceId}>
                <span>{item.date}</span>
                <div>
                  <strong>{item.type}</strong>
                  <p className="activity-meta">{item.notes}</p>
                </div>
                <span>{vendor?.name || item.vendorId}</span>
                <StatusBadge label={item.status} tone={maintenanceTone[item.status]} />
              </article>
            );
          })}
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
          Alta de activos, codigos reales, depreciacion automatica, adjuntos, ubicacion por GPS y mantenimiento operativo quedan para fases funcionales.
        </p>
      </section>
    </>
  );
}
