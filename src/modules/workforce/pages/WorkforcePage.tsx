import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, FileWarning, Plus, Search, UserCheck, Users } from "lucide-react";
import { BasicModal } from "../../../shared/components/BasicModal";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { workforceCalendar, workforceMembers, type AvailabilityStatus, type WorkerStatus } from "../mock-data/workforceData";

const workerTone: Record<WorkerStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Activo: "success",
  Disponible: "info",
  Asignado: "warning",
  "En descanso": "neutral",
  "Documento pendiente": "danger",
};

type WorkforcePageProps = {
  basePath: "/admin/trabajadores" | "/manager/trabajadores";
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function WorkforcePage({ basePath, roleLabel }: WorkforcePageProps) {
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<AvailabilityStatus | "Todos">("Todos");
  const [modalOpen, setModalOpen] = useState(false);

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return workforceMembers.filter((member) => {
      const matchesQuery =
        !normalizedQuery ||
        [member.name, member.role, member.trade, member.email].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesAvailability = availability === "Todos" || member.availability === availability;
      return matchesQuery && matchesAvailability;
    });
  }, [availability, query]);

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - V0.5`}
        title="Trabajadores"
        description="Directorio, oficios, disponibilidad, documentos, asignaciones y calendario visual. Sin nomina ni sincronizacion."
        actions={
          <Button icon={<Plus size={18} />} onClick={() => setModalOpen(true)}>
            Nuevo trabajador visual
          </Button>
        }
      />

      <section className="grid stats-grid">
        <StatCard label="Trabajadores" value={String(workforceMembers.length)} note="Directorio visual" tone="info" icon={Users} />
        <StatCard
          label="Disponibles"
          value={String(workforceMembers.filter((member) => member.availability === "Disponible").length)}
          note="Sin calendario real"
          tone="positive"
          icon={UserCheck}
        />
        <StatCard
          label="Documentos por revisar"
          value={String(workforceMembers.filter((member) => member.status === "Documento pendiente").length + 2)}
          note="Estados visuales"
          tone="danger"
          icon={FileWarning}
        />
        <StatCard label="Asignaciones" value="6" note="Mock data local" tone="warning" icon={CalendarDays} />
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Directorio</h2>
            <p className="activity-meta">El Trabajador no accede a este directorio administrativo.</p>
          </div>
          <StatusBadge label="V0.5 visual" tone="info" />
        </div>
        <div className="filters-row">
          <label className="search-box crm-search">
            <Search size={18} />
            <input
              aria-label="Buscar trabajadores"
              placeholder="Buscar por nombre, oficio, rol o correo"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="form-control filter-control">
            <span className="visual-field-label">Disponibilidad</span>
            <select
              className="select"
              value={availability}
              onChange={(event) => setAvailability(event.target.value as AvailabilityStatus | "Todos")}
            >
              <option>Todos</option>
              <option>Disponible</option>
              <option>Asignado</option>
              <option>No disponible</option>
            </select>
          </label>
        </div>

        {filteredMembers.length > 0 ? (
          <div className="responsive-table" style={{ marginTop: 16 }}>
            <div className="table-header workforce-table-grid">
              <span>Trabajador</span>
              <span>Oficio</span>
              <span>Estado</span>
              <span>Asignaciones</span>
              <span>Accion</span>
            </div>
            {filteredMembers.map((member) => (
              <article className="table-row workforce-table-grid" key={member.workerId}>
                <div>
                  <strong>{member.name}</strong>
                  <p className="activity-meta">{member.role}</p>
                </div>
                <div>
                  <strong>{member.trade}</strong>
                  <p className="activity-meta">{member.skills.slice(0, 2).join(", ")}</p>
                </div>
                <StatusBadge label={member.status} tone={workerTone[member.status]} />
                <span>{member.assignments.length} visuales</span>
                <Link className="button button-secondary" to={`${basePath}/${member.workerId}`}>
                  Ver ficha
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Sin trabajadores" description="No hay resultados con esos filtros. Estado visual de V0.5." />
        )}
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <h2 className="card-title">Calendario visual de asignaciones</h2>
          <StatusBadge label="Sin sincronizacion" tone="neutral" />
        </div>
        <div className="workforce-calendar">
          {workforceCalendar.map((day) => (
            <article className="calendar-day" key={day.day}>
              <strong>{day.day}</strong>
              <div className="grid">
                {day.slots.map((slot) => (
                  <span className="calendar-slot" key={slot}>
                    {slot}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <BasicModal title="Trabajador visual" open={modalOpen} onClose={() => setModalOpen(false)}>
        <p className="page-description">
          Esta accion solo representa el alta de personal. No crea usuario, no guarda datos, no calcula nomina y no sincroniza calendario.
        </p>
      </BasicModal>
    </>
  );
}
