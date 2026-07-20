import type { ApiRouteContract } from "../../core/httpTypes";

export const estimateApiRoutes: ApiRouteContract[] = [
  {
    method: "GET",
    path: "/api/estimates",
    moduleId: "estimates",
    capability: "estimates.read",
    handlerName: "estimates.list",
    authRequired: true,
    auditEvent: "estimates.read",
  },
  {
    method: "POST",
    path: "/api/estimates",
    moduleId: "estimates",
    capability: "estimates.create",
    handlerName: "estimates.create",
    authRequired: true,
    auditEvent: "estimates.created",
  },
  {
    method: "POST",
    path: "/api/estimates/:estimateId/versions",
    moduleId: "estimates",
    capability: "estimates.update",
    handlerName: "estimates.versions.create",
    authRequired: true,
    auditEvent: "estimates.version.created",
  },
  {
    method: "POST",
    path: "/api/estimates/:estimateId/approve",
    moduleId: "estimates",
    capability: "estimates.approve",
    handlerName: "estimates.approve",
    authRequired: true,
    auditEvent: "estimates.approved",
  },
];
