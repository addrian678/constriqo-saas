import type { ModuleManifest } from "../../core/contracts/moduleManifest";

export const attendanceModuleManifest: ModuleManifest = {
  id: "attendance",
  label: "Asistencia y jornada",
  version: "0.6.0-visual",
  routes: [
    "/admin/control-horario",
    "/manager/control-horario",
    "/worker/mi-jornada",
    "/worker/asistencia",
    "/worker/historial-de-horas",
  ],
  navigationRoles: ["admin", "manager", "worker"],
  capabilities: ["time.read", "time.review", "time.approve", "time.clock.visual"],
  dependencies: ["jobs", "workforce", "audit"],
  featureFlag: "attendance",
  phase: "V0.6",
};
