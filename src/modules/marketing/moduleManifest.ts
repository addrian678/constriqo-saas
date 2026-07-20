import type { ModuleManifest } from "../../core/contracts/moduleManifest";

export const marketingModuleManifest: ModuleManifest = {
  id: "marketing",
  label: "Marketing, leads y campanas",
  version: "0.1.0-functional-prep",
  routes: ["/admin/marketing", "/manager/marketing"],
  navigationRoles: ["admin", "manager"],
  capabilities: ["marketing.read", "marketing.manage", "marketing.leads.convert"],
  dependencies: ["crm", "estimates", "notifications-audit-reports"],
  featureFlag: "marketing",
  phase: "F3.5",
};
