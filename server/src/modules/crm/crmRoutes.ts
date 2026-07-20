import type { ApiRouteContract } from "../../core/httpTypes";

export const crmApiRoutes: ApiRouteContract[] = [
  {
    method: "GET",
    path: "/api/crm/clients",
    moduleId: "crm",
    capability: "clients.read",
    handlerName: "crm.clients.list",
    authRequired: true,
    auditEvent: "crm.clients.read",
  },
  {
    method: "POST",
    path: "/api/crm/clients",
    moduleId: "crm",
    capability: "clients.create",
    handlerName: "crm.clients.create",
    authRequired: true,
    auditEvent: "crm.clients.created",
  },
  {
    method: "PATCH",
    path: "/api/crm/clients/:clientId",
    moduleId: "crm",
    capability: "clients.update",
    handlerName: "crm.clients.update",
    authRequired: true,
    auditEvent: "crm.clients.updated",
  },
  {
    method: "POST",
    path: "/api/crm/activities",
    moduleId: "crm",
    capability: "clients.update",
    handlerName: "crm.activities.create",
    authRequired: true,
    auditEvent: "crm.activities.created",
  },
];
