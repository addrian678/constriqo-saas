import type { ModuleManifest } from "../../core/contracts/moduleManifest";

export const assetsModuleManifest: ModuleManifest = {
  id: "assets-liabilities",
  label: "Activos, pasivos y obligaciones",
  version: "0.12.0-visual",
  routes: ["/admin/activos", "/admin/pasivos"],
  navigationRoles: ["admin"],
  capabilities: ["assets.read", "liabilities.read", "obligations.review.visual"],
  dependencies: ["finance", "documents", "expenses", "notifications"],
  featureFlag: "assetsLiabilities",
  phase: "V0.12",
};
