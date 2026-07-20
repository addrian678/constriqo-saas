export type EstimateStatus = "draft" | "sent" | "approved" | "rejected" | "archived";
export type EstimateVersionStatus = "draft" | "current" | "superseded";

export type EstimateEntity = {
  estimateId: string;
  tenantId: string;
  clientId: string;
  estimateNumber: string;
  status: EstimateStatus;
  totalAmount: number;
  currency: string;
};

export type EstimateVersionEntity = {
  estimateVersionId: string;
  tenantId: string;
  estimateId: string;
  versionNumber: number;
  status: EstimateVersionStatus;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
};

export type EstimateSectionEntity = {
  estimateSectionId: string;
  tenantId: string;
  estimateVersionId: string;
  title: string;
  sortOrder: number;
};

export type EstimateItemEntity = {
  estimateItemId: string;
  tenantId: string;
  estimateSectionId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
};
