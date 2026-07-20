import type { ApiRouteContract } from "../../core/httpTypes";

export const assetsApiRoutes: ApiRouteContract[] = [
  {
    method: "GET",
    path: "/api/assets",
    moduleId: "assets-liabilities",
    capability: "assets.read",
    handlerName: "assets.list",
    authRequired: true,
    auditEvent: "assets.read",
  },
  {
    method: "POST",
    path: "/api/assets",
    moduleId: "assets-liabilities",
    capability: "assets.manage",
    handlerName: "assets.create",
    authRequired: true,
    auditEvent: "assets.created",
  },
  {
    method: "GET",
    path: "/api/liabilities",
    moduleId: "assets-liabilities",
    capability: "liabilities.read",
    handlerName: "liabilities.list",
    authRequired: true,
    auditEvent: "liabilities.read",
  },
];
