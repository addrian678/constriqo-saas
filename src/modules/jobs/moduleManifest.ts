import type { ModuleManifest } from "../../core/contracts/moduleManifest";

export const jobsModuleManifest: ModuleManifest = {
  id: "jobs",
  label: "Trabajos / Obras",
  version: "0.4.0-visual",
  routes: ["/admin/obras", "/admin/obras/:jobId", "/manager/obras", "/manager/obras/:jobId"],
  navigationRoles: ["admin", "manager"],
  capabilities: ["jobs.read", "jobs.create", "jobs.update", "jobs.review"],
  dependencies: ["crm", "estimates", "workforce", "documents"],
  featureFlag: "jobs",
  phase: "V0.4",
};
