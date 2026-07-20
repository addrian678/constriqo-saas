export type LicenseStatus = "prepared" | "active" | "expired" | "suspended" | "revoked";

export type LicensedModuleEntitlement = {
  moduleId: string;
  enabled: boolean;
  expiresAt?: string;
};

export type SignedInstallationLicense = {
  licenseId: string;
  subject: string;
  installationId: string;
  issuedAt: string;
  expiresAt?: string;
  entitlements: LicensedModuleEntitlement[];
  signature: string;
};

export type LicenseValidationResult = {
  status: LicenseStatus;
  valid: boolean;
  reason?: string;
  entitlements: LicensedModuleEntitlement[];
};
