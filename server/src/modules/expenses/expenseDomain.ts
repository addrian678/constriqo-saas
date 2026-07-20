export type ExpenseStatus = "draft" | "pending_approval" | "approved" | "paid" | "overdue" | "rejected";
export type VendorStatus = "active" | "under_review" | "inactive";

export type VendorEntity = {
  vendorId: string;
  tenantId: string;
  name: string;
  status: VendorStatus;
  category?: string;
};

export type ExpenseEntity = {
  expenseId: string;
  tenantId: string;
  vendorId?: string;
  jobId?: string;
  status: ExpenseStatus;
  totalAmount: number;
  balanceAmount: number;
};

export type ExpenseItemEntity = {
  expenseItemId: string;
  tenantId: string;
  expenseId: string;
  description: string;
  quantity: number;
  totalAmount: number;
};
