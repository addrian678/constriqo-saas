import { requestBlob, requestJson } from "../../../app/auth/authClient";

export type InvoiceStatus = "draft" | "issued" | "sent" | "partial" | "paid" | "overdue" | "void";

export type Invoice = {
  invoiceId: string;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  jobId?: string | null;
  jobNumber: string;
  jobTitle: string;
  estimateId?: string | null;
  estimateNumber: string;
  invoiceNumber: string;
  invoiceType: string;
  title: string;
  status: InvoiceStatus;
  subtotalAmount: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  balanceAmount: number;
  currency: "USD" | "COP" | "EUR";
  issueDate: string;
  dueDate: string;
  countryProfile: "US" | "CO" | "ES";
  documentLanguage: "es" | "en";
  billingSnapshot: Record<string, unknown>;
  costBreakdown?: Record<string, unknown>;
  companySnapshot?: Record<string, unknown>;
  templateId?: "invoice_clean_red" | "invoice_compact_navy";
  correctsInvoiceId?: string | null;
  correctsInvoiceNumber: string;
  correctionReason: string;
  pdfDocumentId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceItem = {
  invoiceItemId: string;
  description: string;
  quantity: number;
  unitCode: string;
  unitPrice: number;
  taxAmount: number;
  totalAmount: number;
};

export type InvoicePayment = {
  paymentId: string;
  amount: number;
  currency: "USD" | "COP" | "EUR";
  method: string;
  status: string;
  receivedAt: string;
  reference: string;
  notes: string;
  receiptNumber: string;
  documentId?: string | null;
};

export type InvoiceStatusHistory = {
  fromStatus: string;
  toStatus: string;
  changedAt: string;
};

export type InvoiceInput = {
  clientId?: string;
  jobId?: string | null;
  estimateId?: string | null;
  title?: string;
  currency?: "USD" | "COP" | "EUR";
  countryProfile?: "US" | "CO" | "ES";
  documentLanguage?: "es" | "en";
  issueDate?: string;
  dueDate?: string;
  discountAmount?: number;
  templateId?: "invoice_clean_red" | "invoice_compact_navy";
  costBreakdown?: Record<string, unknown>;
  items?: Array<{
    description: string;
    quantity: number;
    unitCode?: string;
    unitPrice: number;
    taxAmount?: number;
  }>;
};

export type EmailDelivery = {
  emailDeliveryId: string;
  recipientEmail: string;
  subject: string;
  templateKey: string;
  provider: string;
  status: string;
  queuedAt: string;
  sentAt?: string | null;
};

export async function listInvoices(token: string): Promise<{ items: Invoice[]; summary: Record<string, number> }> {
  return requestJson<{ items: Invoice[]; summary: Record<string, number> }>("/api/invoicing/invoices", {
    method: "GET",
    token,
  });
}

export async function getInvoice(token: string, invoiceId: string): Promise<{
  invoice: Invoice;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  history: InvoiceStatusHistory[];
}> {
  return requestJson<{
    invoice: Invoice;
    items: InvoiceItem[];
    payments: InvoicePayment[];
    history: InvoiceStatusHistory[];
  }>(`/api/invoicing/invoices/${invoiceId}`, {
    method: "GET",
    token,
  });
}

export async function createInvoice(token: string, input: InvoiceInput): Promise<Invoice> {
  const response = await requestJson<{ invoice: Invoice }>("/api/invoicing/invoices", {
    method: "POST",
    token,
    body: input,
  });
  return response.invoice;
}

export async function issueInvoice(token: string, invoiceId: string): Promise<Invoice> {
  const response = await requestJson<{ invoice: Invoice }>(`/api/invoicing/invoices/${invoiceId}/issue`, {
    method: "POST",
    token,
    body: {},
  });
  return response.invoice;
}

export async function updateInvoiceStatus(token: string, invoiceId: string, status: InvoiceStatus): Promise<Invoice> {
  const response = await requestJson<{ invoice: Invoice }>(`/api/invoicing/invoices/${invoiceId}/status`, {
    method: "PATCH",
    token,
    body: { status },
  });
  return response.invoice;
}

export async function recordInvoicePayment(
  token: string,
  invoiceId: string,
  input: { amount: number; method: string; receivedAt?: string; reference?: string; notes?: string },
): Promise<{ invoice: Invoice; payment: InvoicePayment }> {
  return requestJson<{ invoice: Invoice; payment: InvoicePayment }>(`/api/invoicing/invoices/${invoiceId}/payments`, {
    method: "POST",
    token,
    body: input,
  });
}

export async function createCreditNote(
  token: string,
  invoiceId: string,
  input: { amount: number; reason: string; title?: string; issueDate?: string },
): Promise<Invoice> {
  const response = await requestJson<{ invoice: Invoice }>(`/api/invoicing/invoices/${invoiceId}/credit-notes`, {
    method: "POST",
    token,
    body: input,
  });
  return response.invoice;
}

export async function downloadInvoicePdf(token: string, invoiceId: string): Promise<Blob> {
  return requestBlob(`/api/invoicing/invoices/${invoiceId}/pdf`, {
    method: "GET",
    token,
  });
}

export async function downloadReceiptPdf(token: string, invoiceId: string, paymentId: string): Promise<Blob> {
  return requestBlob(`/api/invoicing/invoices/${invoiceId}/payments/${paymentId}/receipt.pdf`, {
    method: "GET",
    token,
  });
}

export async function sendInvoiceEmail(token: string, invoiceId: string, input: { recipientEmail?: string; subject?: string; bodyText?: string } = {}): Promise<EmailDelivery> {
  const response = await requestJson<{ delivery: EmailDelivery }>(`/api/invoicing/invoices/${invoiceId}/send-email`, {
    method: "POST",
    token,
    body: input,
  });
  return response.delivery;
}
