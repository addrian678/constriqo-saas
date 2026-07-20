import type { RequestContext } from "../../core/requestContext";
import type { ListResult, RepositoryResult } from "../../persistence/repositoryContracts";
import type { FinancialAccountEntity, FinancialTransactionEntity, JobProfitabilityEntity } from "./financeDomain";

export type CreateFinancialTransactionInput = {
  accountId: string;
  type: FinancialTransactionEntity["type"];
  amount: number;
  occurredAt: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

export type FinanceRepository = {
  listAccounts(context: RequestContext): Promise<ListResult<FinancialAccountEntity>>;
  listTransactions(context: RequestContext): Promise<ListResult<FinancialTransactionEntity>>;
  createTransaction(context: RequestContext, input: CreateFinancialTransactionInput): Promise<RepositoryResult<FinancialTransactionEntity>>;
  listJobProfitability(context: RequestContext): Promise<ListResult<JobProfitabilityEntity>>;
};
