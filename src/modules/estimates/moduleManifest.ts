import type { ModuleManifest } from "../../core/contracts/moduleManifest";
import { capabilities } from "../../core/permissions/capabilities";

export const estimatesModuleManifest: ModuleManifest = {
  id: "estimates",
  label: "Cotizaciones",
  version: "0.3.0-visual-planned",
  routes: ["/admin/cotizaciones", "/manager/cotizaciones"],
  navigationRoles: ["admin", "manager"],
  capabilities: [
    capabilities.estimatesRead,
    capabilities.estimatesCreate,
    capabilities.estimatesUpdate,
    capabilities.estimatesApprove,
  ],
  dependencies: ["crm", "construction-profile", "document-templates"],
  featureFlag: "estimates",
  phase: "V0.3",
};
