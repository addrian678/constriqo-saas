import { requestJson } from "../../../app/auth/authClient";

export type AssetStatus = "active" | "maintenance" | "retired";
export type LiabilityStatus = "active" | "paid" | "defaulted" | "cancelled";

export type Asset = {
  assetId: string;
  code: string;
  name: string;
  category: string;
  status: AssetStatus;
  bookValue: number;
  warrantyExpiresAt: string;
  createdAt: string;
};

export type Liability = {
  liabilityId: string;
  reference: string;
  lender: string;
  status: LiabilityStatus;
  principalAmount: number;
  balanceAmount: number;
  nextDueDate: string;
  createdAt: string;
};

export type AssetInput = {
  name: string;
  category: string;
  status?: AssetStatus;
  bookValue: number;
  warrantyExpiresAt?: string;
};

export type LiabilityInput = {
  lender: string;
  status?: LiabilityStatus;
  principalAmount: number;
  balanceAmount?: number;
  nextDueDate?: string;
};

export type AssetSummary = {
  bookValue: number;
  active: number;
  maintenance: number;
  retired: number;
};

export type LiabilitySummary = {
  principalAmount: number;
  balanceAmount: number;
  overdue: number;
  active: number;
  paid: number;
};

export async function listAssets(token: string): Promise<{ items: Asset[]; summary: AssetSummary }> {
  return requestJson<{ items: Asset[]; summary: AssetSummary }>("/api/assets", {
    method: "GET",
    token,
  });
}

export async function createAsset(token: string, input: AssetInput): Promise<Asset> {
  const response = await requestJson<{ asset: Asset }>("/api/assets", {
    method: "POST",
    token,
    body: input,
  });
  return response.asset;
}

export async function listLiabilities(token: string): Promise<{ items: Liability[]; summary: LiabilitySummary }> {
  return requestJson<{ items: Liability[]; summary: LiabilitySummary }>("/api/liabilities", {
    method: "GET",
    token,
  });
}

export async function createLiability(token: string, input: LiabilityInput): Promise<Liability> {
  const response = await requestJson<{ liability: Liability }>("/api/liabilities", {
    method: "POST",
    token,
    body: input,
  });
  return response.liability;
}
