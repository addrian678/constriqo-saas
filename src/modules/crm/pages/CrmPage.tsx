import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, KanbanSquare, Plus, Search, SlidersHorizontal, Users } from "lucide-react";
import { BasicModal } from "../../../shared/components/BasicModal";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { clients, leads, type ClientStatus, type LeadStatus } from "../mock-data/crmData";

const leadColumns: LeadStatus[] = ["Nuevo", "Contactado", "Visita programada", "Cotizacion solicitada"];

const clientTone: Record<ClientStatus, "success" | "warning" | "neutral"> = {
  Activo: "success",
  "En seguimiento": "warning",
  Inactivo: "neutral",
};

const leadTone: Record<LeadStatus, "info" | "warning" | "success" | "neutral"> = {
  Nuevo: "neutral",
  Contactado: "info",
  "Visita programada": "warning",
  "Cotizacion solicitada": "success",
};

type CrmPageProps = {
  basePath: "/admin/crm" | "/manager/clientes";
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function CrmPage({ basePath, roleLabel }: CrmPageProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ClientStatus | "Todos">("Todos");
  const [modalOpen, setModalOpen] = useState(false);

  const filteredClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesQuery =
        !normalizedQuery ||
        [client.name, client.contactName, client.email, client.address].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      const matchesStatus = status === "Todos" || client.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status]);

  const getClientHref = (clientId: string) =>
    basePath === "/admin/crm" ? `${basePath}/clientes/${clientId}` : `${basePath}/${clientId}`;

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - V0.2`}
        title="CRM y clientes"
        description="Prospectos, clientes, actividades y filtros visuales con datos simulados. Sin conversion real, guardado ni backend."
        actions={
          <Button icon={<Plus size={18} />} onClick={() => setModalOpen(true)}>
            Nuevo prospecto
          </Button>
        }
      />

      <section className="grid stats-grid">
        <article className="stat-card">
          <div className="stat-top">
            <div>
              <p className="stat-label">Clientes</p>
              <p className="stat-value">{clients.length}</p>
            </div>
            <span className="stat-icon info">
              <Building2 size={21} />
            </span>
          </div>
          <span className="stat-note">Cartera simulada</span>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <div>
              <p className="stat-label">Prospectos</p>
              <p className="stat-value">{leads.length}</p>
            </div>
            <span className="stat-icon warning">
              <KanbanSquare size={21} />
            </span>
          </div>
          <span className="stat-note">Pipeline visual</span>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <div>
              <p className="stat-label">Oportunidades abiertas</p>
              <p className="stat-value">{clients.reduce((total, client) => total + client.openOpportunities, 0)}</p>
            </div>
            <span className="stat-icon positive">
              <Users size={21} />
            </span>
          </div>
          <span className="stat-note">Base para cotizaciones V0.3</span>
        </article>
        <article className="stat-card">
          <div className="stat-top">
            <div>
              <p className="stat-label">Acciones simuladas</p>
              <p className="stat-value">0</p>
            </div>
            <span className="stat-icon danger">
              <SlidersHorizontal size={21} />
            </span>
          </div>
          <span className="stat-note">Nada se guarda al recargar</span>
        </article>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <h2 className="card-title">Prospectos</h2>
          <StatusBadge label="Kanban visual" tone="info" />
        </div>
        <div className="kanban-board">
          {leadColumns.map((column) => {
            const columnLeads = leads.filter((lead) => lead.status === column);
            return (
              <div className="kanban-column" key={column}>
                <div className="kanban-column-header">
                  <strong>{column}</strong>
                  <StatusBadge label={String(columnLeads.length)} tone={leadTone[column]} />
                </div>
                <div className="grid">
                  {columnLeads.map((lead) => (
                    <article className="kanban-card" key={lead.leadId}>
                      <div className="card-title-row">
                        <h3 className="alert-title">{lead.name}</h3>
                        <StatusBadge label={lead.estimatedValue} tone="neutral" />
                      </div>
                      <p className="activity-meta">{lead.projectType}</p>
                      <p className="activity-meta">{lead.address}</p>
                      <p className="alert-text">{lead.nextAction}</p>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Clientes</h2>
            <p className="activity-meta">Estos registros alimentan las cotizaciones mediante `clientId`.</p>
          </div>
          <StatusBadge label="Datos simulados" tone="neutral" />
        </div>
        <div className="filters-row">
          <label className="search-box crm-search">
            <Search size={18} />
            <input
              aria-label="Buscar clientes"
              placeholder="Buscar por cliente, contacto, correo o direccion"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="form-control filter-control">
            <span className="visual-field-label">Estado</span>
            <select className="select" value={status} onChange={(event) => setStatus(event.target.value as ClientStatus | "Todos")}>
              <option>Todos</option>
              <option>Activo</option>
              <option>En seguimiento</option>
              <option>Inactivo</option>
            </select>
          </label>
        </div>

        {filteredClients.length > 0 ? (
          <div className="responsive-table" style={{ marginTop: 16 }}>
            <div className="table-header crm-table-grid">
              <span>Cliente</span>
              <span>Contacto</span>
              <span>Estado</span>
              <span>Responsable</span>
              <span>Accion</span>
            </div>
            {filteredClients.map((client) => (
              <article className="table-row crm-table-grid" key={client.clientId}>
                <div>
                  <strong>{client.name}</strong>
                  <p className="activity-meta">{client.address}</p>
                </div>
                <div>
                  <strong>{client.contactName}</strong>
                  <p className="activity-meta">{client.email}</p>
                </div>
                <StatusBadge label={client.status} tone={clientTone[client.status]} />
                <span>{client.responsibleName}</span>
                <Link className="button button-secondary" to={getClientHref(client.clientId)}>
                  Ver ficha
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Sin resultados" description="Ajusta la busqueda o el filtro. Este estado tambien es parte de la maqueta V0.2." />
        )}
      </section>

      <section className="grid proof-grid" style={{ marginTop: 18 }}>
        <div className="worker-card">
          <h2 className="card-title">Formulario simulado</h2>
          <p className="activity-meta">Representa alta/edicion de prospecto sin guardar datos.</p>
          <div className="grid proof-grid" style={{ marginTop: 14 }}>
            <VisualField label="Cliente o prospecto" value="Nombre visible" />
            <VisualField label="Origen" value="Web, referido, llamada" />
            <VisualField label="Responsable" value="Maria Torres / David Herrera" />
            <VisualField label="Proxima accion" value="Llamar, visitar, preparar cotizacion" />
          </div>
        </div>
        <div className="worker-card">
          <h2 className="card-title">Estados de CRM</h2>
          <div className="grid status-grid" style={{ marginTop: 14 }}>
            <StatusBadge label="Carga visual" tone="neutral" />
            <StatusBadge label="Error visual" tone="danger" />
            <StatusBadge label="Sin resultados" tone="warning" />
          </div>
        </div>
      </section>

      <BasicModal title="Accion simulada" open={modalOpen} onClose={() => setModalOpen(false)}>
        <p className="page-description">
          En V0.2 este boton solo confirma el flujo visual. El alta real, validaciones, duplicados y permisos quedan para F2.2.
        </p>
      </BasicModal>
    </>
  );
}
