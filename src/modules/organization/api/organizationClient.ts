import { peekCachedJson, requestJson } from "../../../app/auth/authClient";

export type CountryProfile = "US" | "CO" | "ES";
export type CurrencyCode = "USD" | "COP" | "EUR";
export type UnitSystem = "imperial" | "metric";
export type LanguageCode = "es" | "en";

export type TenantSettings = {
  tenantId: string;
  companyName: string;
  industryProfile: string;
  countryProfile: CountryProfile;
  currency: CurrencyCode;
  unitSystem: UnitSystem;
  locale: string;
  timezone: string;
  appLanguage: LanguageCode;
  documentLanguage: LanguageCode;
  tenantSlug: string;
  legalName: string;
  taxId: string;
  contractorLicense: string;
  companyAddress: string;
  companyCity: string;
  companyRegion: string;
  companyPostalCode: string;
  companyCountry: string;
  companyPhone: string;
  workerSupportPhone: string;
  workerSupportWhatsappUrl: string;
  companyEmail: string;
  companyWebsite: string;
  logoUrl: string;
  estimateTemplateId: "estimate_classic_blue" | "estimate_cleaning_teal";
  invoiceTemplateId: "invoice_clean_red" | "invoice_compact_navy";
  documentCompanyVisibility: {
    logo: boolean;
    commercialName: boolean;
    legalName: boolean;
    taxId: boolean;
    license: boolean;
    address: boolean;
    phone: boolean;
    email: boolean;
    website: boolean;
  };
  documentSignature: {
    name: string;
    title: string;
    imageUrl: string;
  };
  updatedAt: string;
};

export type PolicyAcceptance = {
  acceptanceId: string;
  policyKey: string;
  policyVersion: string;
  language: LanguageCode;
  consentType: string;
  status: string;
  acceptedAt: string;
  revokedAt?: string | null;
};

export type PrivacyPreferences = {
  preferenceId: string;
  policyVersion: string;
  language: LanguageCode;
  necessaryCookies: boolean;
  analyticsCookies: boolean;
  marketingCookies: boolean;
  emailCommunications: boolean;
  smsCommunications: boolean;
  pushNotifications: boolean;
  updatedAt: string;
};

export type TenantUsage = {
  planCode: "starter" | "growth" | "dedicated";
  storageQuotaMb: number;
  storageUsedBytes: number;
  storageUsagePercent: number;
  documentQuota: number;
  documentCount: number;
  documentUsagePercent: number;
  heavyFileReferences: number;
  cleanedHeavyFiles: number;
  photoEvidenceEnabled: boolean;
  marketingAddonEnabled: boolean;
  dedicatedStorageEnabled: boolean;
  status: "ok" | "warning" | "danger" | "blocked";
  updatedAt: string;
};

export type TenantUserRole = "admin" | "manager" | "worker";
export type TenantUserStatus = "active" | "inactive" | "suspended";

export type TenantUser = {
  userId: string;
  email: string;
  displayName: string;
  status: TenantUserStatus;
  roles: TenantUserRole[];
  workerId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantUserInput = {
  email: string;
  displayName: string;
  role: TenantUserRole;
  password?: string;
};

export async function getTenantSettings(token: string): Promise<TenantSettings> {
  const response = await requestJson<{ settings: TenantSettings }>("/api/organization/settings", {
    method: "GET",
    token,
  });
  return response.settings;
}

export function getCachedTenantSettings(token: string): TenantSettings | null {
  return peekCachedJson<{ settings: TenantSettings }>(token, "/api/organization/settings")?.settings || null;
}

export async function updateTenantSettings(token: string, input: Partial<TenantSettings>): Promise<TenantSettings> {
  const response = await requestJson<{ settings: TenantSettings }>("/api/organization/settings", {
    method: "PATCH",
    token,
    body: input,
  });
  return response.settings;
}

export async function listPolicyAcceptances(token: string): Promise<PolicyAcceptance[]> {
  const response = await requestJson<{ items: PolicyAcceptance[] }>("/api/compliance/policy-acceptances", {
    method: "GET",
    token,
  });
  return response.items;
}

export async function acceptRequiredPolicies(token: string, input: { policyVersion: string; language: LanguageCode }): Promise<PolicyAcceptance[]> {
  const response = await requestJson<{ items: PolicyAcceptance[] }>("/api/compliance/policy-acceptances", {
    method: "POST",
    token,
    body: {
      policyVersion: input.policyVersion,
      language: input.language,
      policies: ["privacy_policy", "terms_of_service", "data_processing", "cookie_policy"],
    },
  });
  return response.items;
}

export async function getPrivacyPreferences(token: string): Promise<PrivacyPreferences> {
  const response = await requestJson<{ preferences: PrivacyPreferences }>("/api/compliance/privacy-preferences", {
    method: "GET",
    token,
  });
  return response.preferences;
}

export async function updatePrivacyPreferences(
  token: string,
  input: Partial<Omit<PrivacyPreferences, "preferenceId" | "necessaryCookies" | "updatedAt">>,
): Promise<PrivacyPreferences> {
  const response = await requestJson<{ preferences: PrivacyPreferences }>("/api/compliance/privacy-preferences", {
    method: "PATCH",
    token,
    body: input,
  });
  return response.preferences;
}

export async function getTenantUsage(token: string): Promise<TenantUsage> {
  const response = await requestJson<{ usage: TenantUsage }>("/api/organization/usage", {
    method: "GET",
    token,
  });
  return response.usage;
}

export function getCachedTenantUsage(token: string): TenantUsage | null {
  return peekCachedJson<{ usage: TenantUsage }>(token, "/api/organization/usage")?.usage || null;
}

export async function updateTenantUsageLimits(token: string, input: Partial<TenantUsage>): Promise<TenantUsage> {
  const response = await requestJson<{ usage: TenantUsage }>("/api/organization/usage", {
    method: "PATCH",
    token,
    body: input,
  });
  return response.usage;
}

export async function listTenantUsers(token: string): Promise<TenantUser[]> {
  const response = await requestJson<{ items: TenantUser[] }>("/api/organization/users", {
    method: "GET",
    token,
  });
  return response.items;
}

export async function createTenantUser(token: string, input: TenantUserInput): Promise<{ user: TenantUser; temporaryPassword: string }> {
  return requestJson<{ user: TenantUser; temporaryPassword: string }>("/api/organization/users", {
    method: "POST",
    token,
    body: input,
  });
}

export async function updateTenantUser(
  token: string,
  userId: string,
  input: Partial<{ displayName: string; status: TenantUserStatus; role: TenantUserRole }>,
): Promise<TenantUser> {
  const response = await requestJson<{ user: TenantUser }>(`/api/organization/users/${userId}`, {
    method: "PATCH",
    token,
    body: input,
  });
  return response.user;
}

export async function resetTenantUserPassword(token: string, userId: string): Promise<{ user: TenantUser; temporaryPassword: string }> {
  return requestJson<{ user: TenantUser; temporaryPassword: string }>(`/api/organization/users/${userId}/reset-password`, {
    method: "POST",
    token,
    body: {},
  });
}
