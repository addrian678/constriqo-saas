import type { ApiRouteContract } from "../../core/httpTypes";

export const documentApiRoutes: ApiRouteContract[] = [
  {
    method: "GET",
    path: "/api/documents",
    moduleId: "documents",
    capability: "documents.read",
    handlerName: "documents.list",
    authRequired: true,
    auditEvent: "documents.read",
  },
  {
    method: "POST",
    path: "/api/documents",
    moduleId: "documents",
    capability: "documents.create",
    handlerName: "documents.create",
    authRequired: true,
    auditEvent: "documents.created",
  },
  {
    method: "POST",
    path: "/api/documents/:documentId/versions",
    moduleId: "documents",
    capability: "documents.update",
    handlerName: "documents.versions.create",
    authRequired: true,
    auditEvent: "documents.version.created",
  },
];
