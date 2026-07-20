import type { RequestContext } from "../../core/requestContext";
import type { ListResult, RepositoryResult } from "../../persistence/repositoryContracts";
import type { JobChangeRequestEntity, JobEntity, JobPhaseEntity, JobTaskEntity } from "./jobDomain";

export type CreateJobInput = {
  clientId: string;
  estimateId?: string;
  jobNumber: string;
  title: string;
  scheduledStart?: string;
  scheduledEnd?: string;
};

export type CreateJobTaskInput = {
  jobId: string;
  jobPhaseId?: string;
  title: string;
  assignedToWorkerId?: string;
};

export type JobRepository = {
  listJobs(context: RequestContext): Promise<ListResult<JobEntity>>;
  findJobById(context: RequestContext, jobId: string): Promise<JobEntity | null>;
  createJob(context: RequestContext, input: CreateJobInput): Promise<RepositoryResult<JobEntity>>;
  listPhases(context: RequestContext, jobId: string): Promise<ListResult<JobPhaseEntity>>;
  listTasks(context: RequestContext, jobId: string): Promise<ListResult<JobTaskEntity>>;
  createTask(context: RequestContext, input: CreateJobTaskInput): Promise<RepositoryResult<JobTaskEntity>>;
  listChangeRequests(context: RequestContext, jobId: string): Promise<ListResult<JobChangeRequestEntity>>;
};
