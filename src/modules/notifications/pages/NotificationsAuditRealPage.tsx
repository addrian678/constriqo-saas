import { Activity, AlertTriangle, Bell, CheckCircle2, Eye, Mail, RefreshCw, Search, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { AuthenticatedSession } from "../../../app/auth/authClient";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import {
  listAuditEvents,
  listEmailDeliveries,
  listNotificationPreferences,
  listRuntimeNotifications,
  markRuntimeNotificationRead,
  markVisibleNotificationsRead,
  updateNotificationPreference,
  type AuditEvent,
  type EmailDelivery,
  type NotificationPreference,
  type NotificationSeverity,
  type RuntimeNotification,
} from "../api/notificationsClient";

type NotificationsAuditRealPageProps = {
  session: AuthenticatedSession;
};

const severityTone: Record<NotificationSeverity, "neutral" | "info" | "warning" | "success" | "danger"> = {
  info: "info",
  warning: "warning",
  danger: "danger",
  success: "success",
};

const statusTone: Record<string, "neutral" | "info" | "warning" | "success" | "danger"> = {
  pending: "warning",
  delivered: "info",
  read: "success",
  resolved: "success",
};

export function NotificationsAuditRealPage({ session }: NotificationsAuditRealPageProps) {
  const [notifications, setNotifications] = useState<RuntimeNotification[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [emailDeliveries, setEmailDeliveries] = useState<EmailDelivery[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [activeView, setActiveView] = useState<"notifications" | "audit" | "email" | "preferences">("notifications");
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filteredNotifications = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return notifications;
    }
    return notifications.filter((notification) =>
      [notification.title, notification.message, notification.audienceRole, notification.relatedEntityType].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }, [notifications, query]);

  const filteredAuditEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return auditEvents.filter((event) => {
      const matchesModule = !moduleFilter || event.moduleId === moduleFilter;
      const matchesQuery =
        !normalized ||
        [event.actorName, event.action, event.moduleId, event.entityType].some((value) => value.toLowerCase().includes(normalized));
      return matchesModule && matchesQuery;
    });
  }, [auditEvents, moduleFilter, query]);

  const filteredEmailDeliveries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return emailDeliveries;
    }
    return emailDeliveries.filter((delivery) =>
      [delivery.recipientEmail, delivery.recipientName, delivery.subject, delivery.templateKey, delivery.relatedEntityType].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    );
  }, [emailDeliveries, query]);

  const modules = useMemo(() => Array.from(new Set(auditEvents.map((event) => event.moduleId))).sort(), [auditEvents]);
  const roles = useMemo(() => Array.from(new Set(notifications.map((notification) => notification.audienceRole))).sort(), [notifications]);
  const pendingCount = notifications.filter((notification) => notification.status === "pending").length;
  const importantCount = notifications.filter((notification) => notification.severity === "danger" || notification.severity === "warning").length;
  const canBulkRead = filteredNotifications.some((notification) => notification.status === "pending" || notification.status === "delivered");

  useEffect(() => {
    void refresh();
  }, [roleFilter, statusFilter]);

  async function refresh(options: { preserveMessage?: boolean } = {}) {
    setLoading(true);
    if (!options.preserveMessage) {
      setMessage(null);
    }
    try {
      const [notificationResult, auditResult, emailResult] = await Promise.all([
        listRuntimeNotifications(session.sessionToken, { role: roleFilter, status: statusFilter }),
        listAuditEvents(session.sessionToken),
        listEmailDeliveries(session.sessionToken),
      ]);
      setNotifications(notificationResult.items);
      setAuditEvents(auditResult.items);
      setEmailDeliveries(emailResult.items);
      if (preferences.length === 0) {
        setPreferences(await listNotificationPreferences(session.sessionToken));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar notificaciones y auditoria.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(notificationId: string) {
    setSavingId(notificationId);
    setMessage(null);
    try {
      await markRuntimeNotificationRead(session.sessionToken, notificationId);
      setMessage("Notificacion marcada como vista.");
      dispatchDataChanged("notifications");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo marcar la notificacion.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleMarkVisibleRead() {
    setSavingId("bulk");
    setMessage(null);
    try {
      const result = await markVisibleNotificationsRead(session.sessionToken, { role: roleFilter, status: statusFilter });
      setMessage(result.updated === 1 ? "1 notificacion marcada como vista." : `${result.updated} notificaciones marcadas como vistas.`);
      dispatchDataChanged("notifications");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron marcar las notificaciones.");
    } finally {
      setSavingId(null);
    }
  }

  async function handlePreferenceToggle(preference: NotificationPreference) {
    setSavingId(`preference:${preference.eventKey}:${preference.channel}`);
    setMessage(null);
    try {
      const updated = await updateNotificationPreference(session.sessionToken, {
        eventKey: preference.eventKey,
        channel: preference.channel,
        enabled: !preference.enabled,
      });
      setPreferences((current) =>
        current.map((item) => (item.eventKey === updated.eventKey && item.channel === updated.channel ? updated : item)),
      );
      setMessage("Preferencia de notificacion guardada.");
      dispatchDataChanged("notifications");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la preferencia.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="production-module-content">
      <PageHeader
        eyebrow="Notificaciones y auditoria F10"
        title="Centro de eventos"
        description="Bandeja real por empresa para alertas internas y bitacora de acciones. Preparado para push nativo en Android."
        actions={
          <div className="segmented-actions">
            <Button variant={activeView === "notifications" ? "primary" : "secondary"} type="button" icon={<Bell size={16} />} onClick={() => setActiveView("notifications")}>
              Notificaciones
            </Button>
            <Button variant={activeView === "audit" ? "primary" : "secondary"} type="button" icon={<ShieldCheck size={16} />} onClick={() => setActiveView("audit")}>
              Auditoria
            </Button>
            <Button variant={activeView === "email" ? "primary" : "secondary"} type="button" icon={<Mail size={16} />} onClick={() => setActiveView("email")}>
              Correos preparados
            </Button>
            <Button variant={activeView === "preferences" ? "primary" : "secondary"} type="button" icon={<CheckCircle2 size={16} />} onClick={() => setActiveView("preferences")}>
              Preferencias
            </Button>
            <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>
              Actualizar
            </Button>
          </div>
        }
      />

      {message ? <p className="login-notice">{message}</p> : null}

      <section className="grid stats-grid crm-real-stats">
        <SummaryCard label="Pendientes" value={loading && notifications.length === 0 ? "Cargando" : pendingCount} icon={<Bell size={20} />} />
        <SummaryCard label="Importantes" value={loading && notifications.length === 0 ? "Cargando" : importantCount} icon={<AlertTriangle size={20} />} />
        <SummaryCard label="Eventos auditados" value={loading && auditEvents.length === 0 ? "Cargando" : auditEvents.length} icon={<Activity size={20} />} />
        <SummaryCard label="Emails preparados" value={loading && emailDeliveries.length === 0 ? "Cargando" : emailDeliveries.length} icon={<Mail size={20} />} />
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="filters-row">
          <label className="search-box crm-search">
            <Search size={18} />
            <input aria-label="Buscar eventos" placeholder="Buscar por titulo, modulo, actor o entidad" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          {activeView === "audit" ? (
            <label className="form-control filter-control">
              <span>Modulo</span>
              <select className="select" value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
                <option value="">Todos</option>
                {modules.map((moduleId) => (
                  <option value={moduleId} key={moduleId}>
                    {moduleId}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {activeView === "notifications" ? (
          <>
            <div className="filters-row" style={{ marginTop: 16 }}>
              <label className="form-control filter-control">
                <span>Destino</span>
                <select className="select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                  <option value="">Todos</option>
                  {roles.map((role) => (
                    <option value={role} key={role}>
                      {role}
                    </option>
                  ))}
                  {!roles.includes("admin") ? <option value="admin">admin</option> : null}
                  {!roles.includes("manager") ? <option value="manager">manager</option> : null}
                  {!roles.includes("worker") ? <option value="worker">worker</option> : null}
                </select>
              </label>
              <label className="form-control filter-control">
                <span>Estado</span>
                <select className="select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">Todos</option>
                  <option value="pending">Pendiente</option>
                  <option value="delivered">Entregada</option>
                  <option value="read">Vista</option>
                  <option value="resolved">Resuelta</option>
                </select>
              </label>
              <Button
                variant="secondary"
                type="button"
                icon={<CheckCircle2 size={16} />}
                onClick={() => void handleMarkVisibleRead()}
                disabled={!canBulkRead || savingId === "bulk"}
              >
                Marcar visibles como vistas
              </Button>
            </div>
          </>
        ) : null}

        {activeView === "notifications" ? (
          filteredNotifications.length > 0 ? (
            <div className="responsive-table" style={{ marginTop: 16 }}>
              <div className="table-header notifications-table-grid">
                <span>Alerta</span>
                <span>Destino</span>
                <span>Prioridad</span>
                <span>Estado</span>
                <span>Accion</span>
              </div>
              {filteredNotifications.map((notification) => (
                <article className="table-row notifications-table-grid" key={notification.notificationId}>
                  <div>
                    <strong>{notification.title}</strong>
                    <p className="activity-meta">{notification.message}</p>
                  </div>
                  <div>
                    <strong>{notification.audienceRole}</strong>
                    <p className="activity-meta">{notification.relatedEntityType || "Sistema"} · {formatDate(notification.createdAt)}</p>
                  </div>
                  <StatusBadge label={severityLabel(notification.severity)} tone={severityTone[notification.severity]} />
                  <StatusBadge label={statusLabel(notification.status)} tone={statusTone[notification.status] || "neutral"} />
                  <Button variant="secondary" type="button" icon={<Eye size={15} />} onClick={() => void handleMarkRead(notification.notificationId)} disabled={savingId === notification.notificationId || notification.status === "read"}>
                    Vista
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin notificaciones" description="No hay alertas reales para los filtros actuales." />
          )
        ) : activeView === "audit" ? (
          filteredAuditEvents.length > 0 ? (
          <div className="responsive-table" style={{ marginTop: 16 }}>
            <div className="table-header audit-table-grid">
              <span>Fecha</span>
              <span>Actor</span>
              <span>Accion</span>
              <span>Modulo</span>
              <span>Resultado</span>
            </div>
            {filteredAuditEvents.map((event) => (
              <article className="table-row audit-table-grid" key={event.auditEventId}>
                <span>{formatDate(event.createdAt)}</span>
                <div>
                  <strong>{event.actorName}</strong>
                  <p className="activity-meta">{event.actorUserId ? "Usuario" : "Sistema"}</p>
                </div>
                <div>
                  <strong>{event.action}</strong>
                  <p className="activity-meta">{event.entityType || "entidad"} {event.entityId ? event.entityId.slice(0, 8) : ""}</p>
                </div>
                <span>{event.moduleId}</span>
                <StatusBadge label={severityLabel(event.severity)} tone={severityTone[event.severity]} />
              </article>
            ))}
          </div>
          ) : (
          <EmptyState title="Sin auditoria" description="Todavia no hay eventos reales para los filtros actuales." />
          )
        ) : activeView === "email" ? (
          filteredEmailDeliveries.length > 0 ? (
            <div className="responsive-table" style={{ marginTop: 16 }}>
              <div className="table-header email-table-grid">
                <span>Fecha</span>
                <span>Destinatario</span>
                <span>Asunto</span>
                <span>Origen</span>
                <span>Estado</span>
              </div>
              {filteredEmailDeliveries.map((delivery) => (
                <article className="table-row email-table-grid" key={delivery.emailDeliveryId}>
                  <span>{formatDate(delivery.queuedAt)}</span>
                  <div>
                    <strong>{delivery.recipientName || delivery.recipientEmail}</strong>
                    <p className="activity-meta">{delivery.recipientEmail}</p>
                  </div>
                  <div>
                    <strong>{delivery.subject}</strong>
                    <p className="activity-meta">{delivery.templateKey || "Plantilla manual"}</p>
                  </div>
                  <div>
                    <strong>{delivery.relatedEntityType || "Sistema"}</strong>
                    <p className="activity-meta">{delivery.provider}</p>
                  </div>
                  <StatusBadge label={emailStatusLabel(delivery.status)} tone={delivery.status === "failed" ? "danger" : delivery.status === "sent" ? "success" : "info"} />
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin correos preparados" description="Todavia no hay correos manuales o automaticos preparados para esta empresa." />
          )
        ) : preferences.length > 0 ? (
          <div className="responsive-table" style={{ marginTop: 16 }}>
            <div className="table-header notifications-table-grid">
              <span>Evento</span>
              <span>Categoria</span>
              <span>Canal</span>
              <span>Estado</span>
              <span>Accion</span>
            </div>
            {preferences.map((preference) => (
              <article className="table-row notifications-table-grid" key={`${preference.eventKey}:${preference.channel}`}>
                <div>
                  <strong>{preference.label}</strong>
                  <p className="activity-meta">{preference.eventKey}</p>
                </div>
                <span>{preference.category}</span>
                <span>{channelLabel(preference.channel)}</span>
                <StatusBadge label={preference.enabled ? "Activo" : "Pausado"} tone={preference.enabled ? "success" : "neutral"} />
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => void handlePreferenceToggle(preference)}
                  disabled={savingId === `preference:${preference.eventKey}:${preference.channel}`}
                >
                  {preference.enabled ? "Pausar" : "Activar"}
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="Sin preferencias" description="No se pudo cargar el catalogo de preferencias de notificacion." />
        )}
      </section>
    </section>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
        </div>
        <span className="stat-icon info">{icon}</span>
      </div>
      <span className="stat-note">Datos reales del tenant</span>
    </article>
  );
}

function severityLabel(value: string) {
  return { info: "Informativa", warning: "Alta", danger: "Critica", success: "Resuelta" }[value] || value;
}

function statusLabel(value: string) {
  return { pending: "Pendiente", delivered: "Entregada", read: "Vista", resolved: "Resuelta" }[value] || value;
}

function channelLabel(value: string) {
  return {
    push_future: "Push futuro",
    email_future: "Email futuro",
    in_app_highlight: "Destacado in-app",
  }[value] || value;
}

function emailStatusLabel(value: string) {
  return {
    queued: "En cola",
    sent: "Enviado",
    failed: "Fallido",
    sandboxed: "Sandbox",
  }[value] || value;
}

function formatDate(value: string) {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function dispatchDataChanged(module: string) {
  window.dispatchEvent(new CustomEvent("constriqo:data-changed", { detail: { module } }));
}
