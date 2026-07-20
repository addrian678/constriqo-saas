export type FinancialAccountStatus = "Activa" | "Revision" | "Archivada visual";
export type TransactionType = "Ingreso visual" | "Egreso visual" | "Transferencia visual";

export type FinancialAccount = {
  accountId: string;
  name: string;
  type: string;
  balance: string;
  status: FinancialAccountStatus;
};

export type CashTransaction = {
  transactionId: string;
  date: string;
  description: string;
  type: TransactionType;
  category: string;
  amount: string;
  relatedEntity: string;
};

export const financialAccounts: FinancialAccount[] = [
  { accountId: "acct-001", name: "Operating Checking", type: "Banco", balance: "$84,250", status: "Activa" },
  { accountId: "acct-002", name: "Cash on hand", type: "Caja", balance: "$1,420", status: "Activa" },
  { accountId: "acct-003", name: "Materials reserve", type: "Reserva", balance: "$12,800", status: "Revision" },
];

export const cashTransactions: CashTransaction[] = [
  {
    transactionId: "txn-001",
    date: "Jul 13",
    description: "Partial payment - Kitchen Renovation",
    type: "Ingreso visual",
    category: "Cobros",
    amount: "$4,000",
    relatedEntity: "INV-2026-041",
  },
  {
    transactionId: "txn-002",
    date: "Jul 12",
    description: "Drywall materials purchase",
    type: "Egreso visual",
    category: "Materiales",
    amount: "$2,840",
    relatedEntity: "VB-2026-118",
  },
  {
    transactionId: "txn-003",
    date: "Jul 11",
    description: "Transfer to materials reserve",
    type: "Transferencia visual",
    category: "Caja",
    amount: "$1,500",
    relatedEntity: "Internal visual",
  },
  {
    transactionId: "txn-004",
    date: "Jul 10",
    description: "Tile vendor partial payment",
    type: "Egreso visual",
    category: "Acabados",
    amount: "$1,000",
    relatedEntity: "TW-2026-077",
  },
];

export const financeSummary = {
  cashAvailable: "$85,670",
  receivables: "$19,525",
  payables: "$6,510",
  netPositionVisual: "$98,685",
  monthlyIncome: "$42,700",
  monthlyExpenses: "$26,430",
  estimatedProfit: "$16,270",
};

export const jobProfitabilityVisual = [
  {
    job: "Kitchen Renovation - Salt Lake City",
    income: "$9,475",
    cost: "$2,840",
    margin: "$6,635",
    status: "En progreso",
  },
  {
    job: "Basement Remodeling - West Jordan",
    income: "$0",
    cost: "$1,250",
    margin: "-$1,250",
    status: "Planificada",
  },
  {
    job: "Bathroom Renovation - Provo",
    income: "$0",
    cost: "$3,420",
    margin: "-$3,420",
    status: "Pendiente de cambio",
  },
];
