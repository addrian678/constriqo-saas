import type { ModuleManifest } from "../../core/contracts/moduleManifest";

export const payrollModuleManifest: ModuleManifest = {
  id: "payroll",
  label: "Nomina operacional",
  version: "0.12.0-real",
  routes: ["/admin/nomina"],
  navigationRoles: ["admin", "manager"],
  capabilities: ["payroll.read", "payroll.manage"],
  dependencies: ["attendance", "workforce", "finance"],
  featureFlag: "payroll",
  phase: "V0.12",
};
