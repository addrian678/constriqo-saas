import { requestJson } from "../../../app/auth/authClient";

export type LicenseStatus = "trial" | "active" | "past_due" | "suspended" | "expired" | "revoked";
export type LicenseDurationPreset = "trial_7d" | "trial_30d" | "one_year" | "two_years" | "manual";

export type TenantLicense = {
  licenseId: string;
  tenantId: string;
  licenseCode: string;
  status: LicenseStatus;
  planCode: "starter" | "growth" | "dedicated";
  startsAt: string;
  expiresAt: string;
  trialEndsAt: string | null;
  durationPreset: LicenseDurationPreset;
  seatsLimit: number;
  storageQuotaMb: number;
  features: Record<string, unknown>;
  notes: string;
  updatedAt: string;
};

export type SuperAdminTenant = {
  tenantId: string;
  companyName: string;
  industryProfile: string;
  locale: string;
  currency: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  license: TenantLicense | null;
  usage: {
    userCount: number;
    documentCount: number;
    storageSizeBytes: number;
    lastActivityAt: string | null;
  };
};

export type SuperAdminTenantSummary = {
  total: number;
  byStatus: Record<string, number>;
  userCount: number;
  storageSizeBytes: number;
  blocked: number;
  expiringSoon: number;
  storageOverQuota: number;
};

export type TenantLicenseInput = {
  status: LicenseStatus;
  planCode: "starter" | "growth" | "dedicated";
  durationPreset: LicenseDurationPreset;
  startsAt?: string;
  expiresAt?: string;
  seatsLimit: number;
  storageQuotaMb: number;
  features?: Record<string, unknown>;
  notes?: string;
};

export type CreateTenantInput = {
  companyName: string;
  industryProfile: "construction" | "cleaning";
  currency: "USD" | "COP" | "EUR";
  locale?: string;
  timezone?: string;
  adminEmail: string;
  adminName: string;
  durationPreset: LicenseDurationPreset;
  status: LicenseStatus;
  planCode: "starter" | "growth" | "dedicated";
  seatsLimit: number;
  storageQuotaMb: number;
  notes?: string;
};

export async function listSuperAdminTenants(token: string): Promise<{
  items: SuperAdminTenant[];
  total: number;
  summary: SuperAdminTenantSummary;
}> {
  return requestJson("/api/super-admin/tenants", {
    method: "GET",
    token,
  });
}

export async function updateTenantLicense(token: string, tenantId: string, input: TenantLicenseInput): Promise<{
  tenant: Omit<SuperAdminTenant, "license" | "usage">;
  license: TenantLicense;
}> {
  return requestJson(`/api/super-admin/tenants/${tenantId}/license`, {
    method: "PATCH",
    token,
    body: input,
  });
}

export async function createTenantFromSuperAdmin(token: string, input: CreateTenantInput): Promise<{
  tenant: Omit<SuperAdminTenant, "license" | "usage">;
  license: TenantLicense;
  initialAdmin: {
    userId: string;
    email: string;
    displayName: string;
    temporaryPassword: string;
    mustSetupMfa: boolean;
  };
}> {
  return requestJson("/api/super-admin/tenants", {
    method: "POST",
    token,
    body: input,
  });
}
