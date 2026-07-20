import type { IndustryProfileId } from "../../../../src/core/contracts/industryProfile";

export type IndustryProfileStatus = "active" | "prepared" | "disabled";

export type TenantIndustryProfileEntity = {
  tenantIndustryProfileId: string;
  tenantId: string;
  profileId: IndustryProfileId;
  status: IndustryProfileStatus;
};

export type IndustryTermEntity = {
  industryTermId: string;
  tenantId: string;
  profileId: IndustryProfileId;
  termKey: string;
  termValue: string;
};

export type ModuleOverrideEntity = {
  moduleOverrideId: string;
  tenantId: string;
  profileId: IndustryProfileId;
  moduleId: string;
  overrideConfig: Record<string, unknown>;
};
