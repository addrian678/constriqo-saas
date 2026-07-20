import type { DemoRole } from "../../../src/core/types/roles";
import { ApiError } from "./errors";
import type { AuthenticatedUser } from "../auth/authTypes";

export type TenantContext = {
  tenantId: string;
  companyName: string;
};

export type ActorContext = {
  userId: string;
  role: DemoRole;
  roles?: DemoRole[];
  capabilities: string[];
};

export type RequestContext = {
  requestId: string;
  tenant: TenantContext;
  actor: ActorContext;
};

export function createRequestContextFromAuthenticatedUser(
  requestId: string,
  user: AuthenticatedUser,
  companyName: string,
): RequestContext {
  if (!user.tenantId || !user.userId) {
    throw new ApiError("AUTH_REQUIRED", 401, "Authenticated session must include tenant and user.");
  }

  if (user.status !== "active") {
    throw new ApiError("FORBIDDEN", 403, "User account is not active.");
  }

  if (user.roles.length === 0) {
    throw new ApiError("FORBIDDEN", 403, "User account has no assigned role.");
  }

  return {
    requestId,
    tenant: {
      tenantId: user.tenantId,
      companyName,
    },
    actor: {
      userId: user.userId,
      role: user.roles[0],
      roles: user.roles,
      capabilities: user.capabilities,
    },
  };
}
