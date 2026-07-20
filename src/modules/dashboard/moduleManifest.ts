import type { ModuleManifest } from "../../core/contracts/moduleManifest";

export const dashboardModuleManifest: ModuleManifest = {
  id: "dashboard",
  label: "Paneles por rol",
  version: "0.16.0-visual",
  routes: ["/admin/inicio", "/manager/inicio", "/worker/inicio"],
  navigationRoles: ["admin", "manager", "worker"],
  capabilities: ["dashboard.read.visual"],
  dependencies: ["core-navigation", "role-visibility"],
  featureFlag: "dashboard",
  phase: "V0.16",
};
