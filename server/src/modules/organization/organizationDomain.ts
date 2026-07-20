export type SettingValueType = "string" | "number" | "boolean" | "json";

export type OrganizationSettingEntity = {
  organizationSettingId: string;
  tenantId: string;
  key: string;
  value: string;
  valueType: SettingValueType;
};

export type FeatureFlagEntity = {
  featureFlagId: string;
  tenantId: string;
  moduleId: string;
  enabled: boolean;
};
