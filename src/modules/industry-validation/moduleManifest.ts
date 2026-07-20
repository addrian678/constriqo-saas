import type { ModuleManifest } from "../../core/contracts/moduleManifest";

export const industryValidationModuleManifest: ModuleManifest = {
  id: "industry-validation",
  label: "Validacion sectorial construccion/aseo",
  version: "0.15.0-visual",
  routes: ["/admin/validacion-sectorial"],
  navigationRoles: ["admin"],
  capabilities: ["industry.validation.read.visual", "profiles.compare.visual"],
  dependencies: ["organization", "crm", "estimates", "jobs", "workforce", "attendance", "documents"],
  featureFlag: "industryValidation",
  phase: "V0.15",
};
