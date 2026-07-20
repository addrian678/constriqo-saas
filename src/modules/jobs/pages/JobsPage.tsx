import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CalendarDays, ClipboardList, MapPin, Plus, Search, Users } from "lucide-react";
import { clients } from "../../crm/mock-data/crmData";
import { BasicModal } from "../../../shared/components/BasicModal";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { jobs, type JobStatus } from "../mock-data/jobsData";

const jobTone: Record<JobStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Planificada: "neutral",
  "En progreso": "success",
  "En pausa": "warning",
  "Pendiente de cambio": "danger",
  "Cerrada visualmente": "info",
};

type JobsPageProps = {
  basePath: "/admin/obras" | "/manager/obras";
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function JobsPage({ basePath, roleLabel }: JobsPageProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<JobStatus | "Todos">("Todos");
  const [modalOpen, setModalOpen] = useState(false);

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const client = clients.find((item) => item.clientId === job.clientId);
      const matchesQuery =
        !normalizedQuery ||
        [job.title, job.jobNumber, job.address, job.supervisor, client?.name || ""].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      const matchesStatus = status === "Todos" || job.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status]);

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - V0.4`}
        title="Obras"
        description="Listado, fases, tareas, equipo, ubicacion visual, documentos, cambios e incidencias. Sin geolocalizacion ni programacion real."
        actions={
          <Button icon={<Plus size={18} />} onClick={() => setModalOpen(true)}>
            Nueva obra visual
          </Button>
        }
      />

      <section className="grid stats-grid">
        <StatCard label="Obras activas" value="3" note="Mock data local" tone="info" icon={Building2} />
        <StatCard label="Tareas abiertas" value="6" note="Sin asignacion real" tone="warning" icon={ClipboardList} />
        <StatCard label="Equipo asignado" value="4" note="Trabajadores simulados" tone="positive" icon={Users} />
        <StatCard label="Cronograma" value="Visual" note="Sin calendario real" tone="danger" icon={CalendarDays} />
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Listado de obras</h2>
            <p className="activity-meta">Las obras se relacionan visualmente con clientes y cotizaciones mediante IDs simulados.</p>
          </div>
          <StatusBadge label="V0.4 visual" tone="info" />
        </div>
        <div className="filters-row">
          <label className="search-box crm-search">
            <Search size={18} />
            <input
              aria-label="Buscar obras"
              placeholder="Buscar por obra, cliente, direccion o responsable"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="form-control filter-control">
            <span className="visual-field-label">Estado</span>
            <select className="select" value={status} onChange={(event) => setStatus(event.target.value as JobStatus | "Todos")}>
              <option>Todos</option>
              <option>Planificada</option>
              <option>En progreso</option>
              <option>En pausa</option>
              <option>Pendiente de cambio</option>
              <option>Cerrada visualmente</option>
            </select>
          </label>
        </div>

        {filteredJobs.length > 0 ? (
          <div className="responsive-table" style={{ marginTop: 16 }}>
            <div className="table-header jobs-table-grid">
              <span>Obra</span>
              <span>Cliente</span>
              <span>Estado</span>
              <span>Calendario</span>
              <span>Accion</span>
            </div>
            {filteredJobs.map((job) => {
              const client = clients.find((item) => item.clientId === job.clientId);
              return (
                <article className="table-row jobs-table-grid" key={job.jobId}>
                  <div>
                    <strong>{job.jobNumber}</strong>
                    <p className="activity-meta">{job.title}</p>
                  </div>
                  <div>
                    <strong>{client?.name}</strong>
                    <p className="activity-meta">{job.address}</p>
                  </div>
                  <StatusBadge label={job.status} tone={jobTone[job.status]} />
                  <span>{job.scheduledWindow}</span>
                  <Link className="button button-secondary" to={`${basePath}/${job.jobId}`}>
                    Ver ficha
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Sin obras" description="No hay resultados para los filtros actuales. Este estado es visual." />
        )}
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <article className="worker-card">
          <div className="card-title-row">
            <h2 className="card-title">Mapa visual</h2>
            <MapPin size={20} />
          </div>
          <div className="map-placeholder">
            <MapPin size={34} />
            Ubicacion representada sin GPS, mapas externos ni geocodificacion.
          </div>
        </article>
        <article className="worker-card">
          <h2 className="card-title">Limites V0.4</h2>
          <p className="activity-meta">
            No se crean trabajos reales desde cotizaciones, no se programa calendario real y no hay calculos de avance o presupuesto.
          </p>
        </article>
      </section>

      <BasicModal title="Obra visual" open={modalOpen} onClose={() => setModalOpen(false)}>
        <p className="page-description">
          Esta accion solo representa el flujo de alta. La creacion real, validaciones, permisos y transicion desde cotizacion quedan para F2.4.
        </p>
      </BasicModal>
    </>
  );
}
