export const authPolicy = {
  publicRegistration: false,
  invitationExpiryHours: 72,
  sessionExpiryHours: 12,
  maxFailedLoginAttempts: 5,
  passwordHash: "argon2id-required",
  tokenStorage: "hash-only",
  auditEvents: [
    "auth.invitation.created",
    "auth.invitation.accepted",
    "auth.invitation.revoked",
    "auth.login.succeeded",
    "auth.login.failed",
    "auth.session.revoked",
  ],
} as const;
