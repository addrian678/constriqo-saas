import type { RequestContext } from "../../core/requestContext";
import type { ListResult, RepositoryResult } from "../../persistence/repositoryContracts";
import type { ChecklistItemEntity, FieldReportEntity, WorkProofEntity } from "./workProofDomain";

export type CreateFieldReportInput = {
  jobId: string;
  reportDate: string;
  notes?: string;
};

export type CreateWorkProofInput = {
  fieldReportId: string;
  storageObjectId?: string;
  caption?: string;
};

export type WorkProofRepository = {
  listFieldReports(context: RequestContext, jobId?: string): Promise<ListResult<FieldReportEntity>>;
  createFieldReport(context: RequestContext, input: CreateFieldReportInput): Promise<RepositoryResult<FieldReportEntity>>;
  submitFieldReport(context: RequestContext, fieldReportId: string): Promise<RepositoryResult<FieldReportEntity>>;
  listProofs(context: RequestContext, fieldReportId: string): Promise<ListResult<WorkProofEntity>>;
  createProof(context: RequestContext, input: CreateWorkProofInput): Promise<RepositoryResult<WorkProofEntity>>;
  listChecklist(context: RequestContext, fieldReportId: string): Promise<ListResult<ChecklistItemEntity>>;
};
