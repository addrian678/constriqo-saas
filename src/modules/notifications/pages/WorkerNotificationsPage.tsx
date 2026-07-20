import { Bell, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { visualNotifications, type NotificationSeverity } from "../mock-data/notificationsData";

const severityTone: Record<NotificationSeverity, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Critica: "danger",
  Alta: "warning",
  Media: "info",
  Informativa: "neutral",
};

export function WorkerNotificationsPage() {
  const workerNotifications = visualNotifications.filter((notification) => notification.audience.includes("worker"));

  return (
    <>
      <section className="worker-hero">
        <div>
          <p>Centro de avisos</p>
          <h1>Notificaciones</h1>
        </div>
        <StatusBadge label="V0.13 visual" tone="info" />
      </section>

      <section className="worker-card" style={{ marginTop: 14 }}>
        <PageHeader
          eyebrow="Trabajador"
          title="Avisos de jornada"
          description="Alertas visuales para seguridad, tareas y evidencias. Sin push notifications ni confirmacion real."
        />
        <div className="grid proof-grid">
          <StatCard label="Nuevas" value={String(workerNotifications.length)} note="Solo pantalla" tone="info" icon={Bell} />
          <StatCard label="Prioridad alta" value="1" note="Revisar antes de salir" tone="warning" icon={ShieldAlert} />
        </div>
      </section>

      <section className="grid" style={{ marginTop: 14 }}>
        {workerNotifications.map((notification) => (
          <article className="worker-card" key={notification.notificationId}>
            <div className="card-title-row">
              <h2 className="card-title">{notification.title}</h2>
              <StatusBadge label={notification.severity} tone={severityTone[notification.severity]} />
            </div>
            <p className="activity-meta">{notification.message}</p>
            <div className="grid proof-grid" style={{ marginTop: 12 }}>
              <StatusBadge label={notification.relatedLabel} tone="neutral" />
              <StatusBadge label={notification.dueLabel} tone={notification.dueLabel.includes("Fin") ? "warning" : "info"} />
            </div>
          </article>
        ))}
      </section>

      <section className="worker-card" style={{ marginTop: 14 }}>
        <div className="card-title-row">
          <h2 className="card-title">Estados visuales</h2>
          <Clock3 size={20} />
        </div>
        <div className="grid status-grid">
          <StatusBadge label="Nueva" tone="danger" />
          <StatusBadge label="Vista" tone="info" />
          <StatusBadge label="Resuelta visualmente" tone="success" />
          <StatusBadge label="Sin sincronizacion real" tone="neutral" />
          <StatusBadge label="Sin push" tone="neutral" />
          <StatusBadge label="Sin lectura guardada" tone="neutral" />
        </div>
      </section>

      <section className="worker-card" style={{ marginTop: 14 }}>
        <div className="card-title-row">
          <h2 className="card-title">Limites de fase</h2>
          <CheckCircle2 size={20} />
        </div>
        <p className="activity-meta">Los avisos no se confirman, no vibran, no se envian y no quedan almacenados en el dispositivo.</p>
      </section>
    </>
  );
}
