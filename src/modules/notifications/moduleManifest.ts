import type { ModuleManifest } from "../../core/contracts/moduleManifest";

export const notificationsModuleManifest: ModuleManifest = {
  id: "notifications-audit-reports",
  label: "Informes, notificaciones y auditoria visual",
  version: "0.13.0-visual",
  routes: ["/admin/informes", "/admin/notificaciones", "/admin/auditoria", "/manager/notificaciones", "/worker/notificaciones"],
  navigationRoles: ["admin", "manager", "worker"],
  capabilities: ["notifications.read", "reports.read.visual", "audit.read.visual"],
  dependencies: ["crm", "jobs", "attendance", "documents", "finance", "assets-liabilities"],
  featureFlag: "notificationsAuditReports",
  phase: "V0.13",
};
