import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Mail, Phone } from "lucide-react";
import { ActivityList } from "../../../shared/components/ActivityList";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { clients, crmActivities } from "../mock-data/crmData";

type ClientDetailPageProps = {
  basePath: "/admin/crm" | "/manager/clientes";
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function ClientDetailPage({ basePath, roleLabel }: ClientDetailPageProps) {
  const { clientId } = useParams();
  const client = clients.find((item) => item.clientId === clientId);

  if (!client) {
    return (
      <>
        <PageHeader eyebrow={roleLabel} title="Cliente no encontrado" />
        <EmptyState title="Ficha no disponible" description="El identificador no existe en los datos simulados de CRM." />
      </>
    );
  }

  const activities = crmActivities
    .filter((activity) => activity.clientId === client.clientId)
    .map((activity) => ({
      title: activity.title,
      meta: `${activity.type} - ${activity.description}`,
      status: activity.date,
      tone: activity.type === "Nota" ? "neutral" : "info",
    })) as Array<{ title: string; meta: string; status: string; tone: "neutral" | "info" }>;

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - Ficha CRM`}
        title={client.name}
        description="Vista de cliente con contacto, actividad, notas y documentos simulados. Sin persistencia ni archivos reales."
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
            <h2 className="card-title">Datos del cliente</h2>
            <StatusBadge label={client.status} tone={client.status === "Activo" ? "success" : "warning"} />
          </div>
          <div className="grid proof-grid">
            <VisualField label="clientId" value={client.clientId} />
            <VisualField label="Contacto principal" value={client.contactName} />
            <VisualField label="Correo" value={client.email} />
            <VisualField label="Telefono" value={client.phone} />
            <VisualField label="Direccion" value={client.address} />
            <VisualField label="Responsable" value={client.responsibleName} />
          </div>
          <div className="worker-actions" style={{ marginTop: 16 }}>
            <Button variant="secondary" icon={<Phone size={18} />}>
              Llamada visual
            </Button>
            <Button variant="secondary" icon={<Mail size={18} />}>
              Correo visual
            </Button>
          </div>
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Actividad</h2>
            <StatusBadge label="Simulada" tone="neutral" />
          </div>
          {activities.length > 0 ? (
            <ActivityList items={activities} />
          ) : (
            <EmptyState title="Sin actividad" description="Todavia no hay eventos simulados para este cliente." />
          )}
        </div>
      </section>

      <section className="grid proof-grid" style={{ marginTop: 18 }}>
        <article className="worker-card">
          <div className="card-title-row">
            <h2 className="card-title">Notas</h2>
            <StatusBadge label="Visual" tone="info" />
          </div>
          <p className="activity-meta">
            Preparar una cotizacion separando alcance, exclusiones y condiciones. No se guarda ninguna nota en esta fase.
          </p>
        </article>
        <article className="worker-card">
          <div className="card-title-row">
            <h2 className="card-title">Documentos relacionados</h2>
            <FileText size={20} />
          </div>
          <p className="activity-meta">
            Espacio reservado para archivos de cliente, contratos y documentos futuros. Sin carga, descarga ni storage.
          </p>
        </article>
      </section>
    </>
  );
}
