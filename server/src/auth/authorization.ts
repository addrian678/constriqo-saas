import { ApiError } from "../core/errors";
import type { RequestContext } from "../core/requestContext";

export function requireCapability(context: RequestContext, capability: string): void {
  if (!context.actor.capabilities.includes(capability)) {
    throw new ApiError("FORBIDDEN", 403, `Capability required: ${capability}`);
  }
}

export function requireTenant(context: RequestContext, tenantId: string): void {
  if (context.tenant.tenantId !== tenantId) {
    throw new ApiError("FORBIDDEN", 403, "Cross-tenant access is not allowed.");
  }
}

export function assertNoPublicRegistration(enabled: boolean): void {
  if (enabled) {
    throw new ApiError("CONFLICT", 409, "Public registration must remain disabled for Constriqo.");
  }
}
