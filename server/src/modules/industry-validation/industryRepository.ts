import type { IndustryProfileId } from "../../../../src/core/contracts/industryProfile";
import type { RequestContext } from "../../core/requestContext";
import type { ListResult, RepositoryResult } from "../../persistence/repositoryContracts";
import type { IndustryTermEntity, ModuleOverrideEntity, TenantIndustryProfileEntity } from "./industryDomain";

export type IndustryRepository = {
  listProfiles(context: RequestContext): Promise<ListResult<TenantIndustryProfileEntity>>;
  prepareProfile(context: RequestContext, profileId: IndustryProfileId): Promise<RepositoryResult<TenantIndustryProfileEntity>>;
  listTerms(context: RequestContext, profileId: IndustryProfileId): Promise<ListResult<IndustryTermEntity>>;
  listModuleOverrides(context: RequestContext, profileId: IndustryProfileId): Promise<ListResult<ModuleOverrideEntity>>;
};
