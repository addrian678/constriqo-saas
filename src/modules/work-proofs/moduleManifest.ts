import type { ModuleManifest } from "../../core/contracts/moduleManifest";

export const workProofsModuleManifest: ModuleManifest = {
  id: "field",
  label: "Campo, pruebas y partes",
  version: "0.7.0-visual",
  routes: [
    "/admin/partes-diarios",
    "/manager/partes-diarios",
    "/worker/pruebas-de-trabajo",
  ],
  navigationRoles: ["admin", "manager", "worker"],
  capabilities: ["field.read", "field.review", "field.create.visual", "incidents.review"],
  dependencies: ["jobs", "workforce", "documents"],
  featureFlag: "field",
  phase: "V0.7",
};
