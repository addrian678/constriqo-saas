import type { RequestContext } from "../../core/requestContext";
import type { ListResult, RepositoryResult } from "../../persistence/repositoryContracts";
import type { InvoiceEntity, InvoiceItemEntity, PaymentEntity } from "./invoiceDomain";

export type CreateInvoiceInput = {
  clientId: string;
  jobId?: string;
  invoiceNumber: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
};

export type RecordPaymentInput = {
  invoiceId: string;
  amount: number;
  receivedAt: string;
  method: string;
};

export type InvoiceRepository = {
  listInvoices(context: RequestContext): Promise<ListResult<InvoiceEntity>>;
  findInvoiceById(context: RequestContext, invoiceId: string): Promise<InvoiceEntity | null>;
  createInvoice(context: RequestContext, input: CreateInvoiceInput): Promise<RepositoryResult<InvoiceEntity>>;
  listInvoiceItems(context: RequestContext, invoiceId: string): Promise<ListResult<InvoiceItemEntity>>;
  recordPayment(context: RequestContext, input: RecordPaymentInput): Promise<RepositoryResult<PaymentEntity>>;
};
