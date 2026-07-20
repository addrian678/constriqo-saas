export type FinancialAccountType = "cash" | "bank" | "receivables" | "payables" | "equity";
export type TransactionType = "income" | "expense" | "transfer" | "adjustment";
export type ReconciliationStatus = "open" | "matched" | "needs_review" | "closed";

export type FinancialAccountEntity = {
  financialAccountId: string;
  tenantId: string;
  name: string;
  type: FinancialAccountType;
  currency: string;
};

export type FinancialTransactionEntity = {
  financialTransactionId: string;
  tenantId: string;
  accountId: string;
  type: TransactionType;
  amount: number;
  occurredAt: string;
};

export type JobProfitabilityEntity = {
  jobId: string;
  tenantId: string;
  incomeAmount: number;
  costAmount: number;
  marginAmount: number;
};
