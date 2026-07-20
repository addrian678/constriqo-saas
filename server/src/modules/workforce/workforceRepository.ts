import type { RequestContext } from "../../core/requestContext";
import type { ListResult, RepositoryResult } from "../../persistence/repositoryContracts";
import type { WorkerAvailabilityEntity, WorkerCertificationEntity, WorkerEntity } from "./workforceDomain";

export type CreateWorkerInput = {
  name: string;
  trade?: string;
  userId?: string;
};

export type UpdateWorkerInput = Partial<CreateWorkerInput> & {
  status?: WorkerEntity["status"];
};

export type WorkforceRepository = {
  listWorkers(context: RequestContext): Promise<ListResult<WorkerEntity>>;
  findWorkerById(context: RequestContext, workerId: string): Promise<WorkerEntity | null>;
  createWorker(context: RequestContext, input: CreateWorkerInput): Promise<RepositoryResult<WorkerEntity>>;
  updateWorker(context: RequestContext, workerId: string, input: UpdateWorkerInput): Promise<RepositoryResult<WorkerEntity>>;
  listAvailability(context: RequestContext, workerId: string): Promise<ListResult<WorkerAvailabilityEntity>>;
  listCertifications(context: RequestContext, workerId: string): Promise<ListResult<WorkerCertificationEntity>>;
};
