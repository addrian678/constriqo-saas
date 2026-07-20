import type { ApiRouteContract } from "../../core/httpTypes";

export const attendanceApiRoutes: ApiRouteContract[] = [
  {
    method: "GET",
    path: "/api/attendance/time-entries",
    moduleId: "attendance",
    capability: "attendance.read",
    handlerName: "attendance.timeEntries.list",
    authRequired: true,
    auditEvent: "attendance.time_entries.read",
  },
  {
    method: "POST",
    path: "/api/attendance/clock-in",
    moduleId: "attendance",
    capability: "attendance.self.visual",
    handlerName: "attendance.clockIn",
    authRequired: true,
    auditEvent: "attendance.clock_in",
  },
  {
    method: "POST",
    path: "/api/attendance/clock-out",
    moduleId: "attendance",
    capability: "attendance.self.visual",
    handlerName: "attendance.clockOut",
    authRequired: true,
    auditEvent: "attendance.clock_out",
  },
  {
    method: "POST",
    path: "/api/attendance/time-entries/:timeEntryId/approve",
    moduleId: "attendance",
    capability: "attendance.review.visual",
    handlerName: "attendance.approve",
    authRequired: true,
    auditEvent: "attendance.approved",
  },
];
