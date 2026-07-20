import type { RequestContext } from "../../core/requestContext";
import type { ListResult, RepositoryResult } from "../../persistence/repositoryContracts";
import type { ExpenseEntity, ExpenseItemEntity, VendorEntity } from "./expenseDomain";

export type CreateExpenseInput = {
  vendorId?: string;
  jobId?: string;
  items: Array<{
    description: string;
    quantity: number;
    amount: number;
  }>;
};

export type ExpenseRepository = {
  listVendors(context: RequestContext): Promise<ListResult<VendorEntity>>;
  listExpenses(context: RequestContext): Promise<ListResult<ExpenseEntity>>;
  createExpense(context: RequestContext, input: CreateExpenseInput): Promise<RepositoryResult<ExpenseEntity>>;
  approveExpense(context: RequestContext, expenseId: string): Promise<RepositoryResult<ExpenseEntity>>;
  listExpenseItems(context: RequestContext, expenseId: string): Promise<ListResult<ExpenseItemEntity>>;
};
