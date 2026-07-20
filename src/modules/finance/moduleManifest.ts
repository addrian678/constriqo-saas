import type { ModuleManifest } from "../../core/contracts/moduleManifest";

export const financeModuleManifest: ModuleManifest = {
  id: "finance",
  label: "Finanzas, caja y contabilidad simplificada",
  version: "0.11.0-visual",
  routes: ["/admin/finanzas", "/manager/informes-operativos"],
  navigationRoles: ["admin", "manager"],
  capabilities: ["finance.read", "cashflow.read", "profitability.review.visual"],
  dependencies: ["invoicing", "expenses", "jobs", "reports"],
  featureFlag: "finance",
  phase: "V0.11",
};
