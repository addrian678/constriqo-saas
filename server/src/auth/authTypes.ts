import type { DemoRole } from "../../../src/core/types/roles";

export type AuthUserStatus = "invited" | "active" | "suspended" | "disabled";
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";
export type SessionStatus = "active" | "revoked" | "expired";

export type AuthenticatedUser = {
  userId: string;
  tenantId: string;
  email: string;
  displayName: string;
  status: AuthUserStatus;
  roles: DemoRole[];
  capabilities: string[];
};

export type Invitation = {
  invitationId: string;
  tenantId: string;
  email: string;
  roleCode: DemoRole;
  status: InvitationStatus;
  expiresAt: string;
  invitedByUserId: string;
};

export type Session = {
  sessionId: string;
  tenantId: string;
  userId: string;
  status: SessionStatus;
  expiresAt: string;
};

export type ResolvedSession = {
  user: AuthenticatedUser;
  session: Session;
  tenant: {
    tenantId: string;
    companyName: string;
  };
};

export type LoginAttempt = {
  email: string;
  tenantId?: string;
  succeeded: boolean;
  reason: "ok" | "not_found" | "bad_password" | "suspended" | "rate_limited" | "mfa_required";
};
