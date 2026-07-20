import { requestJson } from "../../../app/auth/authClient";

export type CampaignStatus = "draft" | "active" | "paused" | "closed";
export type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "discarded";
export type ConsentStatus = "pending" | "accepted" | "rejected";
export type LoyaltyCardStatus = "active" | "redeemed" | "expired" | "cancelled";
export type LoyaltyRewardType = "discount_percent" | "discount_amount" | "gift" | "custom";

export type MarketingCampaign = {
  campaignId: string;
  name: string;
  channel: string;
  status: CampaignStatus;
  budgetAmount: number;
  leadsCount: number;
  conversionsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MarketingLead = {
  leadId: string;
  campaignId: string | null;
  campaignName: string;
  name: string;
  source: string;
  serviceInterest: string;
  status: LeadStatus;
  consentStatus: ConsentStatus;
  convertedClientId: string | null;
  email: string;
  phone: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type MarketingLoyaltyCard = {
  loyaltyCardId: string;
  cardCode: string;
  title: string;
  customerName: string;
  customerPhone: string;
  requiredStamps: number;
  currentStamps: number;
  rewardType: LoyaltyRewardType;
  rewardValue: number | null;
  rewardDescription: string;
  status: LoyaltyCardStatus;
  expiresOn: string;
  createdAt: string;
  updatedAt: string;
};

export type CampaignInput = {
  name: string;
  channel: string;
  status: CampaignStatus;
  budgetAmount: number;
};

export type LeadInput = {
  campaignId?: string;
  name: string;
  source: string;
  serviceInterest?: string;
  status: LeadStatus;
  consentStatus: ConsentStatus;
  email?: string;
  phone?: string;
  notes?: string;
};

export type LoyaltyCardInput = {
  title: string;
  customerName?: string;
  customerPhone?: string;
  requiredStamps: number;
  currentStamps?: number;
  rewardType: LoyaltyRewardType;
  rewardValue?: number | null;
  rewardDescription: string;
  status?: LoyaltyCardStatus;
  expiresOn?: string;
};

export async function listMarketingCampaigns(token: string): Promise<MarketingCampaign[]> {
  const response = await requestJson<{ items: MarketingCampaign[] }>("/api/marketing/campaigns", {
    method: "GET",
    token,
  });
  return response.items;
}

export async function createMarketingCampaign(token: string, input: CampaignInput): Promise<MarketingCampaign> {
  const response = await requestJson<{ campaign: MarketingCampaign }>("/api/marketing/campaigns", {
    method: "POST",
    token,
    body: input,
  });
  return response.campaign;
}

export async function listMarketingLeads(token: string): Promise<{ items: MarketingLead[]; summary: Record<string, number> }> {
  return requestJson<{ items: MarketingLead[]; summary: Record<string, number> }>("/api/marketing/leads", {
    method: "GET",
    token,
  });
}

export async function createMarketingLead(token: string, input: LeadInput): Promise<MarketingLead> {
  const response = await requestJson<{ lead: MarketingLead }>("/api/marketing/leads", {
    method: "POST",
    token,
    body: input,
  });
  return response.lead;
}

export async function convertMarketingLead(token: string, leadId: string): Promise<{ lead: MarketingLead; clientId: string }> {
  return requestJson<{ lead: MarketingLead; clientId: string }>(`/api/marketing/leads/${leadId}/convert`, {
    method: "POST",
    token,
    body: {},
  });
}

export async function listMarketingLoyaltyCards(token: string): Promise<{ items: MarketingLoyaltyCard[]; summary: Record<string, number> }> {
  return requestJson<{ items: MarketingLoyaltyCard[]; summary: Record<string, number> }>("/api/marketing/loyalty-cards", {
    method: "GET",
    token,
  });
}

export async function createMarketingLoyaltyCard(token: string, input: LoyaltyCardInput): Promise<MarketingLoyaltyCard> {
  const response = await requestJson<{ card: MarketingLoyaltyCard }>("/api/marketing/loyalty-cards", {
    method: "POST",
    token,
    body: input,
  });
  return response.card;
}

export async function updateMarketingLoyaltyCard(token: string, loyaltyCardId: string, input: Partial<LoyaltyCardInput>): Promise<MarketingLoyaltyCard> {
  const response = await requestJson<{ card: MarketingLoyaltyCard }>(`/api/marketing/loyalty-cards/${loyaltyCardId}`, {
    method: "PATCH",
    token,
    body: input,
  });
  return response.card;
}
