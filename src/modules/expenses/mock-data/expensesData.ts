import { jobs } from "../../jobs/mock-data/jobsData";

export type ExpenseStatus = "Borrador" | "Pendiente de aprobacion" | "Aprobado visualmente" | "Vencido" | "Pagado visualmente";
export type VendorStatus = "Activo" | "En revision" | "Inactivo";

export type Vendor = {
  vendorId: string;
  name: string;
  category: string;
  contact: string;
  phone: string;
  status: VendorStatus;
};

export type PurchaseItem = {
  purchaseItemId: string;
  description: string;
  quantity: string;
  amount: string;
};

export type Expense = {
  expenseId: string;
  billNumber: string;
  vendorId: string;
  jobId: string;
  category: string;
  status: ExpenseStatus;
  issueDate: string;
  dueDate: string;
  total: string;
  paid: string;
  balance: string;
  approvalStatus: "Sin revisar" | "Aprobacion visual" | "Requiere ajuste";
  requestedBy: string;
  items: PurchaseItem[];
  notes: string;
};

export const vendors: Vendor[] = [
  {
    vendorId: "vendor-001",
    name: "Wasatch Building Supply",
    category: "Materiales",
    contact: "Ethan Clark",
    phone: "(801) 555-0188",
    status: "Activo",
  },
  {
    vendorId: "vendor-002",
    name: "Utah Equipment Rentals",
    category: "Equipos",
    contact: "Ava Brooks",
    phone: "(385) 555-0141",
    status: "Activo",
  },
  {
    vendorId: "vendor-003",
    name: "Provo Tile Warehouse",
    category: "Acabados",
    contact: "Mason Lee",
    phone: "(801) 555-0172",
    status: "En revision",
  },
];

export const expenses: Expense[] = [
  {
    expenseId: "expense-001",
    billNumber: "VB-2026-118",
    vendorId: vendors[0].vendorId,
    jobId: jobs[0].jobId,
    category: "Materiales",
    status: "Pendiente de aprobacion",
    issueDate: "Jul 12, 2026",
    dueDate: "Aug 11, 2026",
    total: "$2,840",
    paid: "$0",
    balance: "$2,840",
    approvalStatus: "Sin revisar",
    requestedBy: "David Herrera",
    items: [
      { purchaseItemId: "pi-001", description: "Drywall sheets", quantity: "42", amount: "$1,680" },
      { purchaseItemId: "pi-002", description: "Joint compound and tape", quantity: "1 lot", amount: "$1,160" },
    ],
    notes: "Compra visual vinculada a Kitchen Renovation. No crea cuenta por pagar real.",
  },
  {
    expenseId: "expense-002",
    billNumber: "ER-2026-044",
    vendorId: vendors[1].vendorId,
    jobId: jobs[1].jobId,
    category: "Alquiler de equipo",
    status: "Borrador",
    issueDate: "Jul 14, 2026",
    dueDate: "Jul 29, 2026",
    total: "$1,250",
    paid: "$0",
    balance: "$1,250",
    approvalStatus: "Sin revisar",
    requestedBy: "Maria Torres",
    items: [{ purchaseItemId: "pi-003", description: "Dust extractor rental", quantity: "5 days", amount: "$1,250" }],
    notes: "Borrador visual. Sin orden de compra real ni adjuntos.",
  },
  {
    expenseId: "expense-003",
    billNumber: "TW-2026-077",
    vendorId: vendors[2].vendorId,
    jobId: jobs[2].jobId,
    category: "Acabados",
    status: "Vencido",
    issueDate: "Jun 18, 2026",
    dueDate: "Jul 08, 2026",
    total: "$3,420",
    paid: "$1,000",
    balance: "$2,420",
    approvalStatus: "Requiere ajuste",
    requestedBy: "David Herrera",
    items: [
      { purchaseItemId: "pi-004", description: "Tile materials", quantity: "1 lot", amount: "$2,900" },
      { purchaseItemId: "pi-005", description: "Grout and trim", quantity: "1 lot", amount: "$520" },
    ],
    notes: "Saldo vencido visual. No hay pago real, asiento contable ni recordatorio.",
  },
];

export const payablesSummary = {
  open: "$6,510",
  overdue: "$2,420",
  drafts: "$1,250",
  approvedVisual: "$0",
};
