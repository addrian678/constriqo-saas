import type { RequestContext } from "../../core/requestContext";
import type { ListResult, RepositoryResult } from "../../persistence/repositoryContracts";
import type { AssetEntity, AssetMaintenanceEntity, LiabilityEntity } from "./assetsDomain";

export type CreateAssetInput = {
  code: string;
  name: string;
  category: string;
  bookValue: number;
};

export type CreateLiabilityInput = {
  reference: string;
  lender: string;
  principalAmount: number;
  balanceAmount: number;
};

export type AssetsRepository = {
  listAssets(context: RequestContext): Promise<ListResult<AssetEntity>>;
  createAsset(context: RequestContext, input: CreateAssetInput): Promise<RepositoryResult<AssetEntity>>;
  listMaintenance(context: RequestContext, assetId: string): Promise<ListResult<AssetMaintenanceEntity>>;
  listLiabilities(context: RequestContext): Promise<ListResult<LiabilityEntity>>;
  createLiability(context: RequestContext, input: CreateLiabilityInput): Promise<RepositoryResult<LiabilityEntity>>;
};
