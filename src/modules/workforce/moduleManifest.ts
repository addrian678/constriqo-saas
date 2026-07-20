import type { ModuleManifest } from "../../core/contracts/moduleManifest";

export const workforceModuleManifest: ModuleManifest = {
  id: "workforce",
  label: "Personal y asignaciones",
  version: "0.5.0-visual",
  routes: [
    "/admin/trabajadores",
    "/admin/trabajadores/:workerId",
    "/manager/trabajadores",
    "/manager/trabajadores/:workerId",
  ],
  navigationRoles: ["admin", "manager"],
  capabilities: ["workers.read", "workers.create", "workers.update", "assignments.read"],
  dependencies: ["users", "jobs", "documents"],
  featureFlag: "workforce",
  phase: "V0.5",
};
