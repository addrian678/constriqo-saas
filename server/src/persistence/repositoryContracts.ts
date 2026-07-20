import type { RequestContext } from "../core/requestContext";

export type EntityId = string;

export type QueryOptions = {
  limit?: number;
  offset?: number;
};

export type RepositoryResult<TEntity> = {
  data: TEntity;
  auditId?: string;
};

export type ListResult<TEntity> = {
  data: TEntity[];
  total: number;
};

export type ReadRepository<TEntity> = {
  findById(context: RequestContext, id: EntityId): Promise<TEntity | null>;
  list(context: RequestContext, options?: QueryOptions): Promise<ListResult<TEntity>>;
};

export type WriteRepository<TEntity, TCreate, TUpdate> = ReadRepository<TEntity> & {
  create(context: RequestContext, input: TCreate): Promise<RepositoryResult<TEntity>>;
  update(context: RequestContext, id: EntityId, input: TUpdate): Promise<RepositoryResult<TEntity>>;
};

export type UnitOfWork = {
  transaction<TValue>(operation: () => Promise<TValue>): Promise<TValue>;
};
