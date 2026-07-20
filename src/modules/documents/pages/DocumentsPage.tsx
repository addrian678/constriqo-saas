import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileArchive, FileClock, FileText, LockKeyhole, Search } from "lucide-react";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { documentFolders, visualDocuments, type DocumentStatus } from "../mock-data/documentsData";

const documentTone: Record<DocumentStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Vigente: "success",
  "Por vencer": "warning",
  "Pendiente de revision": "danger",
  "Archivado visual": "neutral",
};

type DocumentsPageProps = {
  basePath: "/admin/documentos" | "/manager/documentos";
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function DocumentsPage({ basePath, roleLabel }: DocumentsPageProps) {
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<string | "Todas">("Todas");

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return visualDocuments.filter((document) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          document.title,
          document.type,
          document.relatedEntityLabel,
          document.owner,
          document.tags.join(" "),
          document.status,
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesFolder = folder === "Todas" || document.folder === folder;
      return matchesQuery && matchesFolder;
    });
  }, [folder, query]);

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - V0.8`}
        title="Documentos"
        description="Biblioteca visual con carpetas, metadatos, permisos, vencimientos y relaciones. Sin subida, descarga ni storage real."
      />

      <section className="grid stats-grid">
        <StatCard label="Documentos" value={String(visualDocuments.length)} note="Metadata simulada" tone="info" icon={FileArchive} />
        <StatCard label="Por vencer" value="1" note="Vencimientos visuales" tone="warning" icon={FileClock} />
        <StatCard label="Restringidos" value="1" note="Permisos visuales" tone="danger" icon={LockKeyhole} />
        <StatCard label="Plantillas" value="1" note="Sin archivos reales" tone="positive" icon={FileText} />
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Biblioteca</h2>
              <p className="activity-meta">Las relaciones apuntan a entidades simuladas mediante IDs estables.</p>
            </div>
            <StatusBadge label="V0.8 visual" tone="info" />
          </div>
          <div className="filters-row">
            <label className="search-box crm-search">
              <Search size={18} />
              <input
                aria-label="Buscar documentos"
                placeholder="Buscar por titulo, entidad, etiqueta o estado"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="form-control filter-control">
              <span className="visual-field-label">Carpeta</span>
              <select className="select" value={folder} onChange={(event) => setFolder(event.target.value)}>
                <option>Todas</option>
                {documentFolders.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>

          {filteredDocuments.length > 0 ? (
            <div className="responsive-table" style={{ marginTop: 16 }}>
              <div className="table-header documents-table-grid">
                <span>Documento</span>
                <span>Relacion</span>
                <span>Estado</span>
                <span>Permiso</span>
                <span>Accion</span>
              </div>
              {filteredDocuments.map((document) => (
                <article className="table-row documents-table-grid" key={document.documentId}>
                  <div>
                    <strong>{document.title}</strong>
                    <p className="activity-meta">{document.folder}</p>
                  </div>
                  <div>
                    <strong>{document.relatedEntityType}</strong>
                    <p className="activity-meta">{document.relatedEntityLabel}</p>
                  </div>
                  <StatusBadge label={document.status} tone={documentTone[document.status]} />
                  <StatusBadge label={document.sensitivity} tone={document.sensitivity === "Restringido" ? "danger" : "neutral"} />
                  <Link className="button button-secondary" to={`${basePath}/${document.documentId}`}>
                    Ver ficha
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin documentos" description="No hay documentos visuales para los filtros actuales." />
          )}
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Carpetas logicas</h2>
            <StatusBadge label="Sin filesystem" tone="neutral" />
          </div>
          <div className="grid">
            {documentFolders.map((item) => (
              <article className="alert-card" key={item}>
                <div className="alert-heading">
                  <h3 className="alert-title">{item}</h3>
                  <FileArchive size={18} />
                </div>
                <p className="alert-text">Agrupacion visual por metadatos. No crea carpetas ni archivos reales.</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
