export type InvoiceStatus = "draft" | "issued" | "partially_paid" | "paid" | "void" | "overdue";
export type PaymentStatus = "pending" | "recorded" | "reversed";

export type InvoiceEntity = {
  invoiceId: string;
  tenantId: string;
  clientId: string;
  jobId?: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  totalAmount: number;
  balanceAmount: number;
};

export type InvoiceItemEntity = {
  invoiceItemId: string;
  tenantId: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
};

export type PaymentEntity = {
  paymentId: string;
  tenantId: string;
  invoiceId: string;
  amount: number;
  status: PaymentStatus;
  receivedAt: string;
};
