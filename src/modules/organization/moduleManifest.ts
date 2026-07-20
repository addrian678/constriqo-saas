import type { ModuleManifest } from "../../core/contracts/moduleManifest";

export const organizationModuleManifest: ModuleManifest = {
  id: "organization",
  label: "Empresa, usuarios, roles y configuracion",
  version: "0.14.0-visual",
  routes: ["/admin/usuarios-y-roles", "/admin/configuracion"],
  navigationRoles: ["admin"],
  capabilities: ["organization.read", "users.read.visual", "roles.read.visual", "settings.read.visual"],
  dependencies: ["notifications-audit-reports", "documents", "workforce", "core-permissions"],
  featureFlag: "organizationSettings",
  phase: "V0.14",
};
