import { clients } from "../../crm/mock-data/crmData";
import { estimates } from "../../estimates/mock-data/estimatesData";
import { jobs } from "../../jobs/mock-data/jobsData";

export type InvoiceStatus = "Borrador" | "Enviada visualmente" | "Vencida" | "Pagada visualmente" | "Pago parcial";
export type PaymentStatus = "Registrado visualmente" | "Pendiente" | "Requiere revision";

export type InvoiceItem = {
  invoiceItemId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
};

export type PaymentRecord = {
  paymentId: string;
  date: string;
  method: string;
  amount: string;
  status: PaymentStatus;
  receiptNumber: string;
};

export type Invoice = {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  jobId: string;
  estimateId: string;
  title: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  taxVisual: string;
  total: string;
  paid: string;
  balance: string;
  language: "Espanol" | "English - United States";
  items: InvoiceItem[];
  payments: PaymentRecord[];
  notes: string;
};

export const invoices: Invoice[] = [
  {
    invoiceId: "invoice-001",
    invoiceNumber: "INV-2026-041",
    clientId: clients[0].clientId,
    jobId: jobs[0].jobId,
    estimateId: estimates[0].estimateId,
    title: "Kitchen Renovation progress billing",
    status: "Pago parcial",
    issueDate: "Jul 13, 2026",
    dueDate: "Aug 12, 2026",
    subtotal: "$9,475",
    taxVisual: "$0 visual",
    total: "$9,475",
    paid: "$4,000",
    balance: "$5,475",
    language: "English - United States",
    items: [
      { invoiceItemId: "ii-001", description: "Progress billing - preparation", quantity: "1", unitPrice: "$4,000", amount: "$4,000" },
      { invoiceItemId: "ii-002", description: "Progress billing - installation", quantity: "1", unitPrice: "$5,475", amount: "$5,475" },
    ],
    payments: [
      {
        paymentId: "pay-001",
        date: "Jul 13, 2026",
        method: "ACH visual",
        amount: "$4,000",
        status: "Registrado visualmente",
        receiptNumber: "RCPT-2026-018",
      },
    ],
    notes: "Factura visual de avance. No se emite documento fiscal ni se registra contabilidad real.",
  },
  {
    invoiceId: "invoice-002",
    invoiceNumber: "INV-2026-042",
    clientId: clients[1].clientId,
    jobId: jobs[1].jobId,
    estimateId: estimates[1].estimateId,
    title: "Basement Remodeling deposit draft",
    status: "Borrador",
    issueDate: "Jul 14, 2026",
    dueDate: "Jul 28, 2026",
    subtotal: "$7,850",
    taxVisual: "$0 visual",
    total: "$7,850",
    paid: "$0",
    balance: "$7,850",
    language: "Espanol",
    items: [
      { invoiceItemId: "ii-003", description: "Deposito inicial visual", quantity: "1", unitPrice: "$7,850", amount: "$7,850" },
    ],
    payments: [],
    notes: "Borrador sin envio, pago ni PDF real.",
  },
  {
    invoiceId: "invoice-003",
    invoiceNumber: "INV-2026-039",
    clientId: clients[2].clientId,
    jobId: jobs[2].jobId,
    estimateId: estimates[2].estimateId,
    title: "Bathroom Renovation materials billing",
    status: "Vencida",
    issueDate: "Jun 20, 2026",
    dueDate: "Jul 10, 2026",
    subtotal: "$6,200",
    taxVisual: "$0 visual",
    total: "$6,200",
    paid: "$0",
    balance: "$6,200",
    language: "English - United States",
    items: [
      { invoiceItemId: "ii-004", description: "Materials allowance visual", quantity: "1", unitPrice: "$6,200", amount: "$6,200" },
    ],
    payments: [
      {
        paymentId: "pay-002",
        date: "Pendiente",
        method: "Not recorded",
        amount: "$0",
        status: "Pendiente",
        receiptNumber: "Pendiente",
      },
    ],
    notes: "Cuenta por cobrar visual. No hay recordatorio real ni integracion de pagos.",
  },
];

export const receivablesSummary = {
  totalOpen: "$19,525",
  overdue: "$6,200",
  collectedVisual: "$4,000",
  draftVisual: "$7,850",
};
