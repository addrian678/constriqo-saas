import type { ModuleManifest } from "../../core/contracts/moduleManifest";

export const expensesModuleManifest: ModuleManifest = {
  id: "expenses",
  label: "Gastos, compras y cuentas por pagar",
  version: "0.10.0-visual",
  routes: ["/admin/gastos", "/admin/gastos/:expenseId", "/manager/gastos", "/manager/gastos/:expenseId"],
  navigationRoles: ["admin", "manager"],
  capabilities: ["expenses.read", "expenses.create.visual", "payables.review", "vendors.read"],
  dependencies: ["jobs", "documents", "finance", "permissions"],
  featureFlag: "expenses",
  phase: "V0.10",
};
