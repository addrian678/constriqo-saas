import { visualDocuments } from "../../documents/mock-data/documentsData";
import { vendors } from "../../expenses/mock-data/expensesData";
import { jobs } from "../../jobs/mock-data/jobsData";

export type AssetStatus = "Operativo" | "Mantenimiento programado" | "Fuera de servicio" | "Garantia por vencer";
export type MaintenanceStatus = "Programado" | "Completado visual" | "Requiere revision";
export type LiabilityStatus = "Al dia" | "Vence pronto" | "Vencida" | "Cerrada visualmente";
export type ObligationStatus = "Pendiente" | "Cubierta visual" | "Revisar";

export type MaintenanceRecord = {
  maintenanceId: string;
  date: string;
  type: string;
  vendorId: string;
  status: MaintenanceStatus;
  notes: string;
};

export type Asset = {
  assetId: string;
  code: string;
  name: string;
  category: string;
  status: AssetStatus;
  assignedJobId: string;
  custodian: string;
  location: string;
  purchaseDate: string;
  purchaseCostVisual: string;
  bookValueVisual: string;
  depreciationVisual: string;
  warrantyExpires: string;
  documentIds: string[];
  maintenance: MaintenanceRecord[];
  notes: string;
};

export type PaymentSchedule = {
  scheduleId: string;
  date: string;
  amount: string;
  status: ObligationStatus;
};

export type Liability = {
  liabilityId: string;
  reference: string;
  lender: string;
  type: string;
  status: LiabilityStatus;
  principalVisual: string;
  balanceVisual: string;
  installmentVisual: string;
  nextDueDate: string;
  relatedAssetId?: string;
  documentIds: string[];
  schedule: PaymentSchedule[];
  notes: string;
};

export const assets: Asset[] = [
  {
    assetId: "asset-001",
    code: "EQ-EX-014",
    name: "Dust extractor HEPA unit",
    category: "Equipo de obra",
    status: "Operativo",
    assignedJobId: jobs[0].jobId,
    custodian: "David Herrera",
    location: "Kitchen Renovation - Salt Lake City",
    purchaseDate: "Apr 18, 2025",
    purchaseCostVisual: "$4,800",
    bookValueVisual: "$3,620",
    depreciationVisual: "$1,180",
    warrantyExpires: "Apr 18, 2027",
    documentIds: [visualDocuments[4].documentId],
    maintenance: [
      {
        maintenanceId: "maint-001",
        date: "Jul 28, 2026",
        type: "Filtro y prueba de succion",
        vendorId: vendors[1].vendorId,
        status: "Programado",
        notes: "Revision visual antes de cierre de fase de drywall.",
      },
      {
        maintenanceId: "maint-002",
        date: "Jun 18, 2026",
        type: "Limpieza general",
        vendorId: vendors[1].vendorId,
        status: "Completado visual",
        notes: "Sin orden de servicio real.",
      },
    ],
    notes: "Activo visual asignado a obra. No calcula depreciacion real ni inventario contable.",
  },
  {
    assetId: "asset-002",
    code: "VH-TR-009",
    name: "Service truck Ford Transit",
    category: "Vehiculo",
    status: "Mantenimiento programado",
    assignedJobId: jobs[1].jobId,
    custodian: "Maria Torres",
    location: "West Jordan yard",
    purchaseDate: "Jan 09, 2024",
    purchaseCostVisual: "$38,900",
    bookValueVisual: "$29,400",
    depreciationVisual: "$9,500",
    warrantyExpires: "Jan 09, 2027",
    documentIds: [visualDocuments[2].documentId, visualDocuments[4].documentId],
    maintenance: [
      {
        maintenanceId: "maint-003",
        date: "Jul 22, 2026",
        type: "Aceite, frenos y llantas",
        vendorId: vendors[1].vendorId,
        status: "Programado",
        notes: "Preparar para inicio de Basement Remodeling.",
      },
    ],
    notes: "Vehiculo con bitacora visual. No integra GPS, combustible ni telemetria.",
  },
  {
    assetId: "asset-003",
    code: "TL-WT-031",
    name: "Tile wet saw",
    category: "Herramienta especializada",
    status: "Garantia por vencer",
    assignedJobId: jobs[2].jobId,
    custodian: "Jose Ramirez",
    location: "Bathroom Renovation - Provo",
    purchaseDate: "Aug 02, 2025",
    purchaseCostVisual: "$1,280",
    bookValueVisual: "$920",
    depreciationVisual: "$360",
    warrantyExpires: "Aug 02, 2026",
    documentIds: [visualDocuments[2].documentId],
    maintenance: [
      {
        maintenanceId: "maint-004",
        date: "Jul 30, 2026",
        type: "Revision de bomba y guia",
        vendorId: vendors[2].vendorId,
        status: "Requiere revision",
        notes: "Alerta visual por garantia cercana.",
      },
    ],
    notes: "Herramienta vinculada a fase de tile. Garantia y mantenimiento son recordatorios visuales.",
  },
];

export const liabilities: Liability[] = [
  {
    liabilityId: "liability-001",
    reference: "LOAN-EQ-2026-014",
    lender: "Mountain Credit Union",
    type: "Prestamo de equipo",
    status: "Al dia",
    principalVisual: "$4,800",
    balanceVisual: "$2,900",
    installmentVisual: "$420 / mes",
    nextDueDate: "Aug 05, 2026",
    relatedAssetId: assets[0].assetId,
    documentIds: [visualDocuments[4].documentId],
    schedule: [
      { scheduleId: "sch-001", date: "Aug 05, 2026", amount: "$420", status: "Pendiente" },
      { scheduleId: "sch-002", date: "Sep 05, 2026", amount: "$420", status: "Pendiente" },
      { scheduleId: "sch-003", date: "Jul 05, 2026", amount: "$420", status: "Cubierta visual" },
    ],
    notes: "Cuotas visuales para planificacion. No ejecuta pago ni amortizacion real.",
  },
  {
    liabilityId: "liability-002",
    reference: "VEH-LEASE-009",
    lender: "Wasatch Fleet Finance",
    type: "Lease vehicular",
    status: "Vence pronto",
    principalVisual: "$38,900",
    balanceVisual: "$24,700",
    installmentVisual: "$780 / mes",
    nextDueDate: "Jul 26, 2026",
    relatedAssetId: assets[1].assetId,
    documentIds: [visualDocuments[2].documentId],
    schedule: [
      { scheduleId: "sch-004", date: "Jul 26, 2026", amount: "$780", status: "Revisar" },
      { scheduleId: "sch-005", date: "Aug 26, 2026", amount: "$780", status: "Pendiente" },
      { scheduleId: "sch-006", date: "Jun 26, 2026", amount: "$780", status: "Cubierta visual" },
    ],
    notes: "Obligacion visual vinculada a vehiculo. No hay conciliacion bancaria ni contrato real adjunto.",
  },
  {
    liabilityId: "liability-003",
    reference: "SUPPLY-NOTE-077",
    lender: vendors[2].name,
    type: "Obligacion proveedor",
    status: "Vencida",
    principalVisual: "$3,420",
    balanceVisual: "$2,420",
    installmentVisual: "Pago unico",
    nextDueDate: "Jul 08, 2026",
    documentIds: [visualDocuments[2].documentId],
    schedule: [
      { scheduleId: "sch-007", date: "Jul 08, 2026", amount: "$2,420", status: "Revisar" },
      { scheduleId: "sch-008", date: "Jun 20, 2026", amount: "$1,000", status: "Cubierta visual" },
    ],
    notes: "Saldo vencido visual desde proveedor. Sin recordatorio real ni pago automatico.",
  },
];

export const assetsSummary = {
  activeValue: "$33,940",
  depreciation: "$11,040",
  maintenanceDue: "3",
  warrantiesDue: "1",
};

export const liabilitiesSummary = {
  totalBalance: "$30,020",
  dueSoon: "$3,200",
  overdue: "$2,420",
  obligations: "8",
};
