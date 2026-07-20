import { peekCachedJson, requestJson } from "../../../app/auth/authClient";

export type Vendor = {
  vendorId: string;
  name: string;
  category: string;
  contactName: string;
  phone: string;
  email: string;
  status: string;
};

export type ExpenseStatus = "draft" | "registered" | "approved" | "paid" | "void";

export type Expense = {
  expenseId: string;
  expenseNumber: string;
  jobId?: string | null;
  jobNumber: string;
  jobTitle: string;
  vendorId?: string | null;
  vendorName: string;
  category: string;
  description: string;
  status: ExpenseStatus;
  totalAmount: number;
  balanceAmount: number;
  taxAmount: number;
  currency: "USD" | "COP" | "EUR";
  issueDate: string;
  dueDate: string;
};

export type FinancialTransaction = {
  transactionId: string;
  accountId?: string;
  accountName: string;
  transactionType: string;
  direction: string;
  amount: number;
  currency: string;
  description: string;
  relatedEntityType?: string;
  relatedEntityId?: string | null;
  status?: "posted" | "corrected" | string;
  correctedByTransactionId?: string | null;
  reversedTransactionId?: string | null;
  correctionGroupId?: string | null;
  occurredAt: string;
};

export type ManualTransactionInput = {
  accountType?: "cash" | "bank" | "receivable" | "payable" | "income" | "expense" | "asset" | "liability" | "equity";
  transactionType: string;
  direction: "debit" | "credit";
  amount: number;
  currency: "USD" | "COP" | "EUR";
  occurredAt?: string;
  description?: string;
};

export type FinanceDashboard = {
  currency: "USD" | "COP" | "EUR";
  summary: {
    income: number;
    expenses: number;
    netProfit: number;
    receivables: number;
    payables: number;
    assets: number;
    liabilities: number;
    equity: number;
    accumulatedIncome?: number;
    accumulatedExpenses?: number;
    accumulatedNetProfit?: number;
  };
  periods: Record<"today" | "week" | "month" | "year", { income: number; expenses: number; netProfit: number }>;
  monthlyHistory?: Array<{ month: string; income: number; expenses: number; netProfit: number }>;
  transactions: FinancialTransaction[];
  jobProfitability: Array<{ jobId: string; jobNumber: string; title: string; income: number; expenses: number; margin: number }>;
};

export type ExpenseInput = {
  vendorId?: string | null;
  vendorName: string;
  jobId?: string | null;
  category: string;
  description?: string;
  currency: "USD" | "COP" | "EUR";
  totalAmount: number;
  taxAmount?: number;
  issueDate?: string;
  dueDate?: string;
};

export async function getFinanceDashboard(token: string): Promise<FinanceDashboard> {
  const response = await requestJson<{ dashboard: FinanceDashboard }>("/api/finance/dashboard", {
    method: "GET",
    token,
  });
  return response.dashboard;
}

export function getCachedFinanceDashboard(token: string): FinanceDashboard | null {
  return peekCachedJson<{ dashboard: FinanceDashboard }>(token, "/api/finance/dashboard")?.dashboard || null;
}

export async function listExpenses(token: string): Promise<{ items: Expense[]; summary: Record<string, number> }> {
  return requestJson<{ items: Expense[]; summary: Record<string, number> }>("/api/expenses", {
    method: "GET",
    token,
  });
}

export async function createExpense(token: string, input: ExpenseInput): Promise<Expense> {
  const response = await requestJson<{ expense: Expense }>("/api/expenses", {
    method: "POST",
    token,
    body: input,
  });
  return response.expense;
}

export async function approveExpense(token: string, expenseId: string): Promise<Expense> {
  const response = await requestJson<{ expense: Expense }>(`/api/expenses/${expenseId}/approve`, {
    method: "POST",
    token,
    body: {},
  });
  return response.expense;
}

export async function recordExpensePayment(token: string, expenseId: string, input: { amount: number; method: string }): Promise<Expense> {
  const response = await requestJson<{ expense: Expense }>(`/api/expenses/${expenseId}/payments`, {
    method: "POST",
    token,
    body: input,
  });
  return response.expense;
}

export async function listVendors(token: string): Promise<Vendor[]> {
  const response = await requestJson<{ items: Vendor[] }>("/api/expenses/vendors", {
    method: "GET",
    token,
  });
  return response.items;
}

export async function createVendor(token: string, input: { name: string; category?: string; phone?: string; email?: string; contactName?: string }): Promise<Vendor> {
  const response = await requestJson<{ vendor: Vendor }>("/api/expenses/vendors", {
    method: "POST",
    token,
    body: input,
  });
  return response.vendor;
}

export async function createManualTransaction(token: string, input: ManualTransactionInput): Promise<FinancialTransaction> {
  const response = await requestJson<{ transaction: FinancialTransaction }>("/api/finance/transactions", {
    method: "POST",
    token,
    body: input,
  });
  return response.transaction;
}

export async function correctManualTransaction(
  token: string,
  transactionId: string,
  input: ManualTransactionInput,
): Promise<{ original: FinancialTransaction; reversal: FinancialTransaction | null; correction: FinancialTransaction | null }> {
  return requestJson<{ original: FinancialTransaction; reversal: FinancialTransaction | null; correction: FinancialTransaction | null }>(
    `/api/finance/transactions/${transactionId}/correct`,
    {
      method: "POST",
      token,
      body: input,
    },
  );
}
