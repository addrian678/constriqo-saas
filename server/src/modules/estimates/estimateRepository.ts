import type { RequestContext } from "../../core/requestContext";
import type { ListResult, RepositoryResult } from "../../persistence/repositoryContracts";
import type { EstimateEntity, EstimateItemEntity, EstimateSectionEntity, EstimateVersionEntity } from "./estimateDomain";

export type CreateEstimateInput = {
  clientId: string;
  estimateNumber: string;
  currency: string;
};

export type CreateEstimateVersionInput = {
  estimateId: string;
  sections: Array<{
    title: string;
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
    }>;
  }>;
};

export type EstimateRepository = {
  listEstimates(context: RequestContext): Promise<ListResult<EstimateEntity>>;
  findEstimateById(context: RequestContext, estimateId: string): Promise<EstimateEntity | null>;
  createEstimate(context: RequestContext, input: CreateEstimateInput): Promise<RepositoryResult<EstimateEntity>>;
  createVersion(context: RequestContext, input: CreateEstimateVersionInput): Promise<RepositoryResult<EstimateVersionEntity>>;
  listSections(context: RequestContext, estimateVersionId: string): Promise<ListResult<EstimateSectionEntity>>;
  listItems(context: RequestContext, estimateSectionId: string): Promise<ListResult<EstimateItemEntity>>;
  approveEstimate(context: RequestContext, estimateId: string): Promise<RepositoryResult<EstimateEntity>>;
};
