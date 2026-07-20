export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export type MarketingLeadStatus = "new" | "contacted" | "qualified" | "converted" | "discarded";
export type ConsentStatus = "pending" | "granted" | "revoked";

export type CampaignEntity = {
  campaignId: string;
  tenantId: string;
  name: string;
  channel: string;
  status: CampaignStatus;
};

export type MarketingLeadEntity = {
  marketingLeadId: string;
  tenantId: string;
  campaignId?: string;
  name: string;
  source: string;
  status: MarketingLeadStatus;
  consentStatus: ConsentStatus;
};
