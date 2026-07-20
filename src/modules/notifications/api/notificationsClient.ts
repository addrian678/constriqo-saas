import { requestJson } from "../../../app/auth/authClient";

export type NotificationSeverity = "info" | "warning" | "danger" | "success";
export type NotificationStatus = "pending" | "delivered" | "read" | "resolved";

export type RuntimeNotification = {
  notificationId: string;
  recipientUserId: string | null;
  audienceRole: string;
  channel: string;
  eventKey: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  relatedEntityType: string;
  relatedEntityId: string | null;
  status: NotificationStatus;
  attempts: number;
  createdAt: string;
  deliveredAt: string;
};

export type AuditEvent = {
  auditEventId: string;
  actorUserId: string | null;
  actorName: string;
  action: string;
  moduleId: string;
  entityType: string;
  entityId: string | null;
  severity: NotificationSeverity;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type NotificationSummary = {
  total: number;
  pending: number;
  read: number;
  important: number;
};

export type AuditSummary = {
  total: number;
  danger: number;
  modules: number;
};

export type NotificationPreference = {
  eventKey: string;
  label: string;
  category: string;
  channel: "push_future" | "email_future" | "in_app_highlight";
  enabled: boolean;
  updatedAt: string;
};

export type EmailDelivery = {
  emailDeliveryId: string;
  recipientEmail: string;
  recipientName: string;
  fromEmail: string;
  replyToEmail: string;
  subject: string;
  templateKey: string;
  provider: string;
  status: "queued" | "sent" | "failed" | "sandboxed";
  relatedEntityType: string;
  relatedEntityId: string | null;
  errorMessage: string;
  queuedByUserId: string | null;
  queuedAt: string;
  sentAt: string;
  updatedAt: string;
};

export async function listRuntimeNotifications(token: string, filters: { role?: string; status?: string } = {}): Promise<{ items: RuntimeNotification[]; summary: NotificationSummary }> {
  const params = new URLSearchParams();
  if (filters.role) {
    params.set("role", filters.role);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  return requestJson<{ items: RuntimeNotification[]; summary: NotificationSummary }>(`/api/notifications${params.size ? `?${params.toString()}` : ""}`, {
    method: "GET",
    token,
  });
}

export async function markRuntimeNotificationRead(token: string, notificationId: string): Promise<RuntimeNotification> {
  const response = await requestJson<{ notification: RuntimeNotification }>(`/api/notifications/${notificationId}/read`, {
    method: "PATCH",
    token,
  });
  return response.notification;
}

export async function markVisibleNotificationsRead(token: string, filters: { role?: string; status?: string } = {}): Promise<{ updated: number; summary: NotificationSummary }> {
  return requestJson<{ updated: number; summary: NotificationSummary }>("/api/notifications/read-visible", {
    method: "POST",
    token,
    body: filters,
  });
}

export async function listAuditEvents(token: string, moduleId = ""): Promise<{ items: AuditEvent[]; summary: AuditSummary }> {
  const params = new URLSearchParams();
  if (moduleId) {
    params.set("moduleId", moduleId);
  }
  return requestJson<{ items: AuditEvent[]; summary: AuditSummary }>(`/api/audit-events${params.size ? `?${params.toString()}` : ""}`, {
    method: "GET",
    token,
  });
}

export async function listEmailDeliveries(token: string, filters: { status?: string; search?: string } = {}): Promise<{ items: EmailDelivery[]; total: number }> {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  return requestJson<{ items: EmailDelivery[]; total: number }>(`/api/email/deliveries${params.size ? `?${params.toString()}` : ""}`, {
    method: "GET",
    token,
  });
}

export async function listNotificationPreferences(token: string): Promise<NotificationPreference[]> {
  const response = await requestJson<{ items: NotificationPreference[] }>("/api/notifications/preferences", {
    method: "GET",
    token,
  });
  return response.items;
}

export async function updateNotificationPreference(token: string, input: Pick<NotificationPreference, "eventKey" | "channel" | "enabled">): Promise<NotificationPreference> {
  const response = await requestJson<{ preference: NotificationPreference }>("/api/notifications/preferences", {
    method: "PATCH",
    token,
    body: input,
  });
  return response.preference;
}
