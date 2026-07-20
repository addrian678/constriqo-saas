import type { ApiRouteContract } from "../../core/httpTypes";

export const industryApiRoutes: ApiRouteContract[] = [
  {
    method: "GET",
    path: "/api/industry/profiles",
    moduleId: "industry-validation",
    capability: "industry.validation.read.visual",
    handlerName: "industry.profiles.list",
    authRequired: true,
    auditEvent: "industry.profiles.read",
  },
  {
    method: "POST",
    path: "/api/industry/profiles/:profileId/prepare",
    moduleId: "industry-validation",
    capability: "profiles.compare.visual",
    handlerName: "industry.profiles.prepare",
    authRequired: true,
    auditEvent: "industry.profile.prepared",
  },
];
