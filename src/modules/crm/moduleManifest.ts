import type { ModuleManifest } from "../../core/contracts/moduleManifest";
import { capabilities } from "../../core/permissions/capabilities";

export const crmModuleManifest: ModuleManifest = {
  id: "crm",
  label: "CRM y Clientes",
  version: "0.2.0-visual",
  routes: ["/admin/crm", "/admin/crm/clientes/:clientId", "/manager/clientes", "/manager/clientes/:clientId"],
  navigationRoles: ["admin", "manager"],
  capabilities: [capabilities.clientsRead, capabilities.clientsCreate, capabilities.clientsUpdate],
  dependencies: ["company", "users"],
  featureFlag: "crm",
  phase: "V0.2",
};
