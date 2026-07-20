import type { ApiRouteContract } from "../../core/httpTypes";

export const workforceApiRoutes: ApiRouteContract[] = [
  {
    method: "GET",
    path: "/api/workforce/workers",
    moduleId: "workforce",
    capability: "workforce.read",
    handlerName: "workforce.workers.list",
    authRequired: true,
    auditEvent: "workforce.workers.read",
  },
  {
    method: "POST",
    path: "/api/workforce/workers",
    moduleId: "workforce",
    capability: "workforce.manage",
    handlerName: "workforce.workers.create",
    authRequired: true,
    auditEvent: "workforce.workers.created",
  },
  {
    method: "PATCH",
    path: "/api/workforce/workers/:workerId",
    moduleId: "workforce",
    capability: "workforce.manage",
    handlerName: "workforce.workers.update",
    authRequired: true,
    auditEvent: "workforce.workers.updated",
  },
];
