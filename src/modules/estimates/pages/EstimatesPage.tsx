import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calculator, Eye, FileText, Plus, Search } from "lucide-react";
import { clients } from "../../crm/mock-data/crmData";
import { BasicModal } from "../../../shared/components/BasicModal";
import { Button } from "../../../shared/components/Button";
import { DocumentLanguageSelector } from "../../../shared/components/DocumentLanguageSelector";
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

type EstimatesPageProps = {
  basePath: "/admin/cotizaciones" | "/manager/cotizaciones";
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function EstimatesPage({ basePath, roleLabel }: EstimatesPageProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<EstimateStatus | "Todos">("Todos");
  const [modalOpen, setModalOpen] = useState(false);

  const filteredEstimates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return estimates.filter((estimate) => {
      const client = clients.find((item) => item.clientId === estimate.clientId);
      const matchesQuery =
        !normalizedQuery ||
        [estimate.title, estimate.estimateNumber, estimate.projectType, client?.name || ""].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      const matchesStatus = status === "Todos" || estimate.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status]);

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - V0.3`}
        title="Cotizaciones"
        description="Listado, partidas, totales simulados, idioma y vista previa. Sin PDF, envio, aprobacion real ni obra automatica."
        actions={
          <Button icon={<Plus size={18} />} onClick={() => setModalOpen(true)}>
            Nueva cotizacion
          </Button>
        }
      />

      <section className="grid stats-grid">
        <article className="stat-card">
          <div className="stat-top">
            <div>
              <p className="stat-label">Cotizaciones</p>
              <p className="stat-value">{estimates.length}</p>
            </div>
            <span className="stat-icon info">
              <FileText size={21} />
            </span>
          </div>
          <span className="stat-note">Datos simulados</span>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <div>
              <p className="stat-label">En revision</p>
              <p className="stat-value">{estimates.filter((estimate) => estimate.status === "En revision").length}</p>
            </div>
            <span className="stat-icon warning">
              <Eye size={21} />
            </span>
          </div>
          <span className="stat-note">Seguimiento comercial</span>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <div>
              <p className="stat-label">Total visual</p>
              <p className="stat-value">$74,950</p>
            </div>
            <span className="stat-icon positive">
              <Calculator size={21} />
            </span>
          </div>
          <span className="stat-note">No es calculo financiero real</span>
        </article>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Listado</h2>
            <p className="activity-meta">Administrador y Gestor pueden revisar esta maqueta; Trabajador queda excluido.</p>
          </div>
          <StatusBadge label="V0.3 visual" tone="info" />
        </div>
        <div className="filters-row">
          <label className="search-box crm-search">
            <Search size={18} />
            <input
              aria-label="Buscar cotizaciones"
              placeholder="Buscar por numero, cliente, obra o tipo"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="form-control filter-control">
            <span className="visual-field-label">Estado</span>
            <select className="select" value={status} onChange={(event) => setStatus(event.target.value as EstimateStatus | "Todos")}>
              <option>Todos</option>
              <option>Borrador</option>
              <option>Enviada</option>
              <option>En revision</option>
              <option>Aprobada visualmente</option>
              <option>Rechazada</option>
            </select>
          </label>
        </div>

        {filteredEstimates.length > 0 ? (
          <div className="responsive-table" style={{ marginTop: 16 }}>
            <div className="table-header estimates-table-grid">
              <span>Cotizacion</span>
              <span>Cliente</span>
              <span>Estado</span>
              <span>Total</span>
              <span>Accion</span>
            </div>
            {filteredEstimates.map((estimate) => {
              const client = clients.find((item) => item.clientId === estimate.clientId);
              return (
                <article className="table-row estimates-table-grid" key={estimate.estimateId}>
                  <div>
                    <strong>{estimate.estimateNumber}</strong>
                    <p className="activity-meta">{estimate.title}</p>
                  </div>
                  <div>
                    <strong>{client?.name}</strong>
                    <p className="activity-meta">{estimate.projectType}</p>
                  </div>
                  <StatusBadge label={estimate.status} tone={estimateTone[estimate.status]} />
                  <strong>{estimate.total}</strong>
                  <Link className="button button-secondary" to={`${basePath}/${estimate.estimateId}`}>
                    Ver detalle
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Sin cotizaciones" description="No hay resultados para los filtros actuales. El estado es visual." />
        )}
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Creacion por pasos</h2>
            <StatusBadge label="Simulada" tone="neutral" />
          </div>
          <div className="estimate-steps">
            {["Cliente", "Alcance", "Partidas", "Condiciones", "Idioma", "Vista previa"].map((step, index) => (
              <div className="estimate-step" key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
          <div className="grid proof-grid" style={{ marginTop: 16 }}>
            <VisualField label="Cliente conectado" value="Seleccion desde CRM mediante clientId" />
            <VisualField label="Aprobacion" value="Solo aviso visual de funcion futura" />
            <VisualField label="PDF" value="No se genera en V0.3" />
            <VisualField label="Obra automatica" value="No se crea en V0.3" />
          </div>
        </div>
        <DocumentLanguageSelector />
      </section>

      <BasicModal title="Nueva cotizacion visual" open={modalOpen} onClose={() => setModalOpen(false)}>
        <p className="page-description">
          Este flujo representa la creacion por pasos. En esta fase no guarda datos, no calcula impuestos, no envia correos y no genera PDF.
        </p>
      </BasicModal>
    </>
  );
}
