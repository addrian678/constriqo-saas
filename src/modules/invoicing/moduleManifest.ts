import type { ModuleManifest } from "../../core/contracts/moduleManifest";

export const invoicingModuleManifest: ModuleManifest = {
  id: "invoicing",
  label: "Facturas, cobros y cuentas por cobrar",
  version: "0.9.0-visual",
  routes: ["/admin/facturas", "/admin/facturas/:invoiceId", "/manager/facturas", "/manager/facturas/:invoiceId", "/manager/cobros"],
  navigationRoles: ["admin", "manager"],
  capabilities: ["invoices.read", "invoices.create.visual", "payments.read", "receivables.review"],
  dependencies: ["crm", "jobs", "estimates", "documents", "finance"],
  featureFlag: "invoicing",
  phase: "V0.9",
};
