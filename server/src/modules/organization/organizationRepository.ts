import type { RequestContext } from "../../core/requestContext";
import type { ListResult, RepositoryResult } from "../../persistence/repositoryContracts";
import type { FeatureFlagEntity, OrganizationSettingEntity } from "./organizationDomain";

export type UpdateSettingInput = {
  key: string;
  value: string;
  valueType: OrganizationSettingEntity["valueType"];
};

export type OrganizationRepository = {
  listSettings(context: RequestContext): Promise<ListResult<OrganizationSettingEntity>>;
  updateSetting(context: RequestContext, input: UpdateSettingInput): Promise<RepositoryResult<OrganizationSettingEntity>>;
  listFeatureFlags(context: RequestContext): Promise<ListResult<FeatureFlagEntity>>;
  setFeatureFlag(context: RequestContext, moduleId: string, enabled: boolean): Promise<RepositoryResult<FeatureFlagEntity>>;
};
