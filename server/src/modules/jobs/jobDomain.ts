export type JobStatus = "planned" | "in_progress" | "paused" | "change_pending" | "closed";
export type JobPhaseStatus = "pending" | "active" | "completed";
export type JobTaskStatus = "pending" | "in_progress" | "blocked" | "completed";

export type JobEntity = {
  jobId: string;
  tenantId: string;
  clientId: string;
  estimateId?: string;
  jobNumber: string;
  title: string;
  status: JobStatus;
};

export type JobPhaseEntity = {
  jobPhaseId: string;
  tenantId: string;
  jobId: string;
  title: string;
  status: JobPhaseStatus;
  sortOrder: number;
};

export type JobTaskEntity = {
  jobTaskId: string;
  tenantId: string;
  jobId: string;
  jobPhaseId?: string;
  title: string;
  status: JobTaskStatus;
  assignedToWorkerId?: string;
};

export type JobChangeRequestEntity = {
  changeRequestId: string;
  tenantId: string;
  jobId: string;
  title: string;
  status: "draft" | "submitted" | "approved" | "rejected";
};
