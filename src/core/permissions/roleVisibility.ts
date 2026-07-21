import type { DemoRole } from "../types/roles";

export const roleRouteScopes: Record<DemoRole, string> = {
  admin: "/admin",
  manager: "/manager",
  worker: "/worker",
  super_admin: "/acceso-admi-proveedor-constriqo",
};
