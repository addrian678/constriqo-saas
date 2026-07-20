import { useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Clock3, Search } from "lucide-react";
import type { DemoRole } from "../../../core/types/roles";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import {
  notificationsSummary,
  visualNotifications,
  type NotificationCategory,
  type NotificationSeverity,
  type NotificationStatus,
} from "../mock-data/notificationsData";

const severityTone: Record<NotificationSeverity, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Critica: "danger",
  Alta: "warning",
  Media: "info",
  Informativa: "neutral",
};

const statusTone: Record<NotificationStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Nueva: "danger",
  "En revision": "warning",
  Vista: "info",
  "Resuelta visualmente": "success",
};

type NotificationsPageProps = {
  role: DemoRole;
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function NotificationsPage({ role, roleLabel }: NotificationsPageProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<NotificationCategory | "Todas">("Todas");

  const visibleNotifications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return visualNotifications.filter((notification) => {
      const matchesRole = notification.audience.includes(role);
      const matchesCategory = category === "Todas" || notification.category === category;
      const matchesQuery =
        !normalizedQuery ||
        [notification.title, notification.message, notification.relatedLabel, notification.sourceModule].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      return matchesRole && matchesCategory && matchesQuery;
    });
  }, [category, query, role]);

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - V0.13`}
        title="Notificaciones"
        description="Bandeja visual de alertas por modulo, prioridad, vencimiento y estado. Sin push, correo, SMS ni recordatorios reales."
      />

      <section className="grid stats-grid">
        <StatCard label="Nuevas" value={notificationsSummary.newItems} note="Visuales" tone="danger" icon={Bell} />
        <StatCard label="Criticas" value={notificationsSummary.criticalItems} note="Requieren revision" tone="warning" icon={AlertTriangle} />
        <StatCard label="En revision" value={notificationsSummary.reviewItems} note="Sin workflow real" tone="info" icon={Clock3} />
        <StatCard label="Canales" value={notificationsSummary.visualChannels} note="Solo pantalla" tone="positive" icon={CheckCircle2} />
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Bandeja de alertas</h2>
            <p className="activity-meta">Los estados no se guardan; cada alerta se deriva de datos simulados.</p>
          </div>
          <StatusBadge label="Centro visual" tone="info" />
        </div>
        <div className="filters-row">
          <label className="search-box crm-search">
            <Search size={18} />
            <input
              aria-label="Buscar notificaciones"
              placeholder="Buscar por alerta, modulo o entidad"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="form-control filter-control">
            <span className="visual-field-label">Categoria</span>
            <select
              className="select"
              value={category}
              onChange={(event) => setCategory(event.target.value as NotificationCategory | "Todas")}
            >
              <option>Todas</option>
              <option>Finanzas</option>
              <option>Obras</option>
              <option>Documentos</option>
              <option>Activos</option>
              <option>Personal</option>
              <option>Sistema</option>
            </select>
          </label>
        </div>

        {visibleNotifications.length > 0 ? (
          <div className="responsive-table" style={{ marginTop: 16 }}>
            <div className="table-header notifications-table-grid">
              <span>Alerta</span>
              <span>Modulo</span>
              <span>Prioridad</span>
              <span>Estado</span>
              <span>Vence</span>
            </div>
            {visibleNotifications.map((notification) => (
              <article className="table-row notifications-table-grid" key={notification.notificationId}>
                <div>
                  <strong>{notification.title}</strong>
                  <p className="activity-meta">{notification.message}</p>
                </div>
                <div>
                  <strong>{notification.sourceModule}</strong>
                  <p className="activity-meta">{notification.relatedLabel}</p>
                </div>
                <StatusBadge label={notification.severity} tone={severityTone[notification.severity]} />
                <StatusBadge label={notification.status} tone={statusTone[notification.status]} />
                <strong>{notification.dueLabel}</strong>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Sin notificaciones" description="No hay resultados para los filtros actuales." />
        )}
      </section>
    </>
  );
}
