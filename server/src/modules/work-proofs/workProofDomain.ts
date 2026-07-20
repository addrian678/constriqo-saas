export type FieldReportStatus = "draft" | "submitted" | "reviewed" | "rejected";
export type ProofStatus = "pending_upload" | "submitted" | "approved" | "rejected";
export type ChecklistStatus = "pending" | "passed" | "failed" | "not_applicable";

export type FieldReportEntity = {
  fieldReportId: string;
  tenantId: string;
  jobId: string;
  reportDate: string;
  status: FieldReportStatus;
};

export type WorkProofEntity = {
  workProofId: string;
  tenantId: string;
  fieldReportId: string;
  storageObjectId?: string;
  status: ProofStatus;
  caption?: string;
};

export type ChecklistItemEntity = {
  checklistItemId: string;
  tenantId: string;
  fieldReportId: string;
  label: string;
  status: ChecklistStatus;
};
