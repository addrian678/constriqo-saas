import type { RequestContext } from "../../core/requestContext";
import type { ListResult, RepositoryResult } from "../../persistence/repositoryContracts";
import type { CampaignEntity, MarketingLeadEntity } from "./marketingDomain";

export type CreateCampaignInput = {
  name: string;
  channel: string;
};

export type CreateMarketingLeadInput = {
  campaignId?: string;
  name: string;
  source: string;
  serviceInterest?: string;
  consentStatus: MarketingLeadEntity["consentStatus"];
};

export type MarketingRepository = {
  listCampaigns(context: RequestContext): Promise<ListResult<CampaignEntity>>;
  createCampaign(context: RequestContext, input: CreateCampaignInput): Promise<RepositoryResult<CampaignEntity>>;
  listLeads(context: RequestContext): Promise<ListResult<MarketingLeadEntity>>;
  createLead(context: RequestContext, input: CreateMarketingLeadInput): Promise<RepositoryResult<MarketingLeadEntity>>;
  convertLeadToCrm(context: RequestContext, marketingLeadId: string): Promise<RepositoryResult<MarketingLeadEntity>>;
};
