import type { DemoRole } from "../../../src/core/types/roles";
import type { RequestContext } from "../core/requestContext";
import type { AuthenticatedUser, Invitation, LoginAttempt, ResolvedSession, Session } from "./authTypes";

export type PasswordHasher = {
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, passwordHash: string): Promise<boolean>;
};

export type TokenHasher = {
  hashToken(token: string): Promise<string>;
  verifyToken(token: string, tokenHash: string): Promise<boolean>;
};

export type CreateInvitationInput = {
  email: string;
  roleCode: DemoRole;
  expiresAt: string;
};

export type LoginInput = {
  tenantId: string;
  email: string;
  password: string;
};

export type LoginResult = {
  user: AuthenticatedUser;
  session: Session;
  sessionToken: string;
};

export type AuthRepository = {
  findUserByEmail(tenantId: string, email: string): Promise<AuthenticatedUser | null>;
  findUserById(tenantId: string, userId: string): Promise<AuthenticatedUser | null>;
  findSessionByTokenHash(tokenHash: string): Promise<ResolvedSession | null>;
  recordLoginAttempt(attempt: LoginAttempt): Promise<void>;
  createSession(user: AuthenticatedUser, tokenHash: string, expiresAt: string): Promise<Session>;
  revokeSession(context: RequestContext, sessionId: string): Promise<void>;
};

export type InvitationRepository = {
  createInvitation(context: RequestContext, input: CreateInvitationInput, tokenHash: string): Promise<Invitation>;
  findPendingInvitationByTokenHash(tokenHash: string): Promise<Invitation | null>;
  acceptInvitation(invitationId: string, userId: string): Promise<void>;
  revokeInvitation(context: RequestContext, invitationId: string): Promise<void>;
};
