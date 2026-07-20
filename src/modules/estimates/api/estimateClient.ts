import { requestBlob, requestJson } from "../../../app/auth/authClient";

export type EstimateStatus = "draft" | "sent" | "review" | "approved" | "rejected" | "cancelled" | "archived";

export type EstimateSummary = {
  estimateId: string;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  estimateNumber: string;
  status: EstimateStatus;
  title: string;
  scope: string;
  totalAmount: number;
  currency: string;
  latestVersion: number | null;
  templateId?: "estimate_classic_blue" | "estimate_cleaning_teal";
  costBreakdown?: EstimateCostBreakdown;
  companySnapshot?: Record<string, unknown>;
  projectSnapshot?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type EstimateListSummary = {
  total: number;
  draft: number;
  sent: number;
  approved: number;
  cancelled?: number;
  totalAmount: number;
};

export type EstimateItemInput = {
  serviceCatalogItemId?: string | null;
  description: string;
  quantity: number;
  unitCode?: string;
  unitSystem?: "imperial" | "metric";
  unitPrice: number;
};

export type EstimateSectionInput = {
  title: string;
  items: EstimateItemInput[];
};

export type EstimateInput = {
  clientId: string;
  title: string;
  scope?: string;
  conditions?: string;
  exclusions?: string;
  currency?: string;
  countryProfile?: "US" | "CO" | "ES";
  unitSystem?: "imperial" | "metric";
  documentLanguage?: "es" | "en";
  taxRate?: number;
  templateId?: "estimate_classic_blue" | "estimate_cleaning_teal";
  project?: {
    name?: string;
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
    overview?: string;
  };
  costBreakdown?: EstimateCostBreakdown;
  sections: EstimateSectionInput[];
};

export type EstimateCostField = {
  enabled?: boolean;
  applies?: boolean;
  mode?: "calculated" | "manual";
  amount: number;
};

export type EstimateCostBreakdown = {
  enabled: boolean;
  materialsSubtotal: EstimateCostField;
  laborSubtotal: EstimateCostField;
  equipmentSubtotal: EstimateCostField;
  subcontractorsSubtotal: EstimateCostField;
  permitsFees: EstimateCostField;
  transport: EstimateCostField;
  wasteManagement: EstimateCostField;
  overhead: EstimateCostField;
  contingency: EstimateCostField;
  profit: EstimateCostField;
  discounts: EstimateCostField;
  taxAmount: EstimateCostField;
  manualTotal: EstimateCostField;
};

export type EstimateSection = {
  sectionId: string;
  title: string;
  sortOrder: number;
  items: Array<EstimateItemInput & { itemId: string; totalAmount: number; serviceSnapshot?: Record<string, unknown> }>;
};

export type EstimateVersion = {
  versionId: string;
  versionNumber: number;
  status: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  snapshot: {
    title?: string;
    scope?: string;
    conditions?: string;
    exclusions?: string;
    taxRate?: number;
    countryProfile?: string;
    unitSystem?: string;
    currency?: string;
    documentLanguage?: string;
    templateId?: string;
    costBreakdown?: EstimateCostBreakdown;
    project?: Record<string, unknown>;
  };
  createdAt: string;
};

export type EstimateDetailResponse = {
  estimate: EstimateSummary;
  versions: EstimateVersion[];
  sections: EstimateSection[];
  approvals: Array<{
    approvalId: string;
    status: string;
    approvedAt: string | null;
    createdAt: string;
  }>;
  history: Array<{
    action: string;
    severity: string;
    metadata: {
      fromStatus?: string;
      toStatus?: string;
      [key: string]: unknown;
    };
    createdAt: string;
  }>;
};

export type EmailDelivery = {
  emailDeliveryId: string;
  recipientEmail: string;
  subject: string;
  templateKey: string;
  provider: string;
  status: string;
  queuedAt: string;
  sentAt?: string | null;
};

export async function listEstimates(token: string): Promise<{
  items: EstimateSummary[];
  total: number;
  summary: EstimateListSummary;
}> {
  return requestJson<{
    items: EstimateSummary[];
    total: number;
    summary: EstimateListSummary;
  }>("/api/estimates", {
    method: "GET",
    token,
  });
}

export async function createEstimate(token: string, input: EstimateInput): Promise<EstimateSummary> {
  const response = await requestJson<{ estimate: EstimateSummary }>("/api/estimates", {
    method: "POST",
    token,
    body: input,
  });
  return response.estimate;
}

export async function getEstimate(token: string, estimateId: string): Promise<EstimateDetailResponse> {
  return requestJson<EstimateDetailResponse>(`/api/estimates/${estimateId}`, {
    method: "GET",
    token,
  });
}

export async function updateEstimateStatus(token: string, estimateId: string, status: EstimateStatus): Promise<EstimateSummary> {
  const response = await requestJson<{ estimate: EstimateSummary }>(`/api/estimates/${estimateId}`, {
    method: "PATCH",
    token,
    body: { status },
  });
  return response.estimate;
}

export async function approveEstimate(token: string, estimateId: string, note?: string): Promise<void> {
  await requestJson(`/api/estimates/${estimateId}/approve`, {
    method: "POST",
    token,
    body: { note },
  });
}

export async function downloadEstimatePdf(token: string, estimateId: string): Promise<Blob> {
  return requestBlob(`/api/estimates/${estimateId}/pdf`, {
    method: "GET",
    token,
  });
}

export async function sendEstimateEmail(token: string, estimateId: string, input: { recipientEmail?: string; subject?: string; bodyText?: string } = {}): Promise<EmailDelivery> {
  const response = await requestJson<{ delivery: EmailDelivery }>(`/api/estimates/${estimateId}/send-email`, {
    method: "POST",
    token,
    body: input,
  });
  return response.delivery;
}
