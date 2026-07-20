import type { ApiRouteContract } from "../../core/httpTypes";

export const marketingApiRoutes: ApiRouteContract[] = [
  {
    method: "GET",
    path: "/api/marketing/campaigns",
    moduleId: "marketing",
    capability: "marketing.read",
    handlerName: "marketing.campaigns.list",
    authRequired: true,
    auditEvent: "marketing.campaigns.read",
  },
  {
    method: "POST",
    path: "/api/marketing/campaigns",
    moduleId: "marketing",
    capability: "marketing.manage",
    handlerName: "marketing.campaigns.create",
    authRequired: true,
    auditEvent: "marketing.campaign.created",
  },
  {
    method: "POST",
    path: "/api/marketing/leads/:marketingLeadId/convert",
    moduleId: "marketing",
    capability: "marketing.leads.convert",
    handlerName: "marketing.leads.convert",
    authRequired: true,
    auditEvent: "marketing.lead.converted",
  },
];
