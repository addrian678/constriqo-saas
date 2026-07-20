import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, LockKeyhole, Tags } from "lucide-react";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { visualDocuments, type DocumentStatus } from "../mock-data/documentsData";

const documentTone: Record<DocumentStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Vigente: "success",
  "Por vencer": "warning",
  "Pendiente de revision": "danger",
  "Archivado visual": "neutral",
};

type DocumentDetailPageProps = {
  basePath: "/admin/documentos" | "/manager/documentos";
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function DocumentDetailPage({ basePath, roleLabel }: DocumentDetailPageProps) {
  const { documentId } = useParams();
  const document = visualDocuments.find((item) => item.documentId === documentId);

  if (!document) {
    return (
      <>
        <PageHeader eyebrow={roleLabel} title="Documento no encontrado" />
        <EmptyState title="Ficha no disponible" description="El identificador no existe en los datos simulados." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - Ficha V0.8`}
        title={document.title}
        description="Ficha visual con metadatos, permisos, vencimiento, relacion y vista previa. Sin archivo real."
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
            <h2 className="card-title">Metadatos</h2>
            <StatusBadge label={document.status} tone={documentTone[document.status]} />
          </div>
          <div className="grid proof-grid">
            <VisualField label="documentId" value={document.documentId} />
            <VisualField label="Tipo" value={document.type} />
            <VisualField label="Carpeta" value={document.folder} />
            <VisualField label="Version" value={document.version} />
            <VisualField label="Responsable" value={document.owner} />
            <VisualField label="Vencimiento" value={document.expires} />
          </div>
          <p className="activity-meta" style={{ marginTop: 14 }}>
            {document.summary}
          </p>
        </div>

        <div className="document-preview">
          <div className="preview-paper">
            <p className="eyebrow">Vista previa visual</p>
            <h2>{document.type}</h2>
            <p>{document.title}</p>
            <hr />
            <p>{document.summary}</p>
            <strong>{document.relatedEntityType}: {document.relatedEntityLabel}</strong>
          </div>
        </div>
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <article className="worker-card">
          <div className="card-title-row">
            <h2 className="card-title">Permisos visuales</h2>
            <LockKeyhole size={20} />
          </div>
          <div className="grid proof-grid">
            <VisualField label="Sensibilidad" value={document.sensitivity} />
            <VisualField label="Acceso trabajador" value={document.sensitivity === "Trabajador autorizado" ? "Permitido visual" : "No mostrado"} />
            <VisualField label="Descarga" value="Deshabilitada en V0.8" />
            <VisualField label="Auditoria" value="Pendiente F1/F2" />
          </div>
        </article>
        <article className="worker-card">
          <div className="card-title-row">
            <h2 className="card-title">Etiquetas y relacion</h2>
            <Tags size={20} />
          </div>
          <div className="grid status-grid">
            {document.tags.map((tag) => (
              <StatusBadge key={tag} label={tag} tone="info" />
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <VisualField label={document.relatedEntityType} value={`${document.relatedEntityLabel} (${document.relatedEntityId})`} />
          </div>
        </article>
      </section>

      <section className="worker-card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <h2 className="card-title">Acciones futuras</h2>
          <FileText size={20} />
        </div>
        <p className="activity-meta">
          Subir archivo, descargar, versionar, firmar, compartir y validar permisos quedan fuera de V0.8.
        </p>
      </section>
    </>
  );
}
