import type { ApiRouteContract } from "../../core/httpTypes";

export const organizationApiRoutes: ApiRouteContract[] = [
  {
    method: "GET",
    path: "/api/organization/settings",
    moduleId: "organization",
    capability: "organization.read",
    handlerName: "organization.settings.list",
    authRequired: true,
    auditEvent: "organization.settings.read",
  },
  {
    method: "PATCH",
    path: "/api/organization/settings/:key",
    moduleId: "organization",
    capability: "organization.manage",
    handlerName: "organization.settings.update",
    authRequired: true,
    auditEvent: "organization.setting.updated",
  },
  {
    method: "PATCH",
    path: "/api/organization/feature-flags/:moduleId",
    moduleId: "organization",
    capability: "organization.manage",
    handlerName: "organization.featureFlags.update",
    authRequired: true,
    auditEvent: "organization.feature_flag.updated",
  },
];
