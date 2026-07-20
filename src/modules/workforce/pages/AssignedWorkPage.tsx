import { projects } from "../../../mock-data/company";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";

export function AssignedWorkPage() {
  return (
    <>
      <PageHeader
        eyebrow="Trabajador"
        title="Trabajos asignados"
        description="Lista visual de trabajos actuales preparada para ampliar en fases posteriores."
      />
      <section className="grid">
        {projects.slice(0, 2).map((project) => (
          <article className="worker-card" key={project}>
            <div className="card-title-row">
              <h2 className="card-title">{project}</h2>
              <StatusBadge label="Asignado" tone="info" />
            </div>
            <p className="activity-meta">Datos simulados. Sin aceptacion, rechazo ni actualizacion real.</p>
          </article>
        ))}
        <EmptyState title="Sin mas trabajos asignados" description="El resto de la planificacion se mantiene fuera del alcance V0.1." />
      </section>
    </>
  );
}
