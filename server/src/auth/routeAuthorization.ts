import type { ApiRouteContract } from "../core/httpTypes";
import type { RequestContext } from "../core/requestContext";
import { requireCapability } from "./authorization";

export type RouteAuthorizationResult = {
  allowed: boolean;
  requiredCapability: string;
  auditEvent: string;
};

export function authorizeRoute(context: RequestContext, route: ApiRouteContract): RouteAuthorizationResult {
  requireCapability(context, route.capability);

  return {
    allowed: true,
    requiredCapability: route.capability,
    auditEvent: route.auditEvent,
  };
}

export function createDeniedAuditEvent(context: RequestContext, route: ApiRouteContract): Record<string, string> {
  return {
    tenantId: context.tenant.tenantId,
    actorUserId: context.actor.userId,
    moduleId: route.moduleId,
    capability: route.capability,
    action: "authorization.denied",
  };
}
