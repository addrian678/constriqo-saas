import { assets, liabilities } from "../../assets/mock-data/assetsData";
import { visualDocuments } from "../../documents/mock-data/documentsData";
import { expenses } from "../../expenses/mock-data/expensesData";
import { invoices } from "../../invoicing/mock-data/invoicingData";
import { jobs } from "../../jobs/mock-data/jobsData";
import { workerDay } from "../../../verticals/construction/mock-data/dashboard";
import type { DemoRole } from "../../../core/types/roles";

export type NotificationSeverity = "Critica" | "Alta" | "Media" | "Informativa";
export type NotificationStatus = "Nueva" | "En revision" | "Vista" | "Resuelta visualmente";
export type NotificationCategory = "Finanzas" | "Obras" | "Documentos" | "Activos" | "Personal" | "Sistema";

export type VisualNotification = {
  notificationId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  status: NotificationStatus;
  audience: DemoRole[];
  sourceModule: string;
  relatedLabel: string;
  dueLabel: string;
};

export type VisualAuditEvent = {
  auditId: string;
  date: string;
  actor: string;
  role: DemoRole;
  action: string;
  module: string;
  result: "Permitido visual" | "Bloqueado visual" | "Revision";
  entity: string;
};

export type VisualReport = {
  reportId: string;
  title: string;
  owner: string;
  scope: string;
  status: "Listo visual" | "Pendiente de datos" | "Revision";
  cadence: string;
  sourceModules: string[];
};

export const visualNotifications: VisualNotification[] = [
  {
    notificationId: "notif-001",
    title: "Factura por cobrar cercana",
    message: "Una factura visual requiere seguimiento antes del cierre semanal.",
    category: "Finanzas",
    severity: "Alta",
    status: "Nueva",
    audience: ["admin", "manager"],
    sourceModule: "invoicing",
    relatedLabel: invoices[0].invoiceNumber,
    dueLabel: invoices[0].dueDate,
  },
  {
    notificationId: "notif-002",
    title: "Gasto vencido de proveedor",
    message: "Saldo visual vencido pendiente de revision administrativa.",
    category: "Finanzas",
    severity: "Critica",
    status: "En revision",
    audience: ["admin"],
    sourceModule: "expenses",
    relatedLabel: expenses[2].billNumber,
    dueLabel: expenses[2].dueDate,
  },
  {
    notificationId: "notif-003",
    title: "Parte diario pendiente",
    message: "La obra tiene actividad visual sin cierre de parte diario.",
    category: "Obras",
    severity: "Media",
    status: "Nueva",
    audience: ["admin", "manager"],
    sourceModule: "work-proofs",
    relatedLabel: jobs[0].jobNumber,
    dueLabel: "Hoy",
  },
  {
    notificationId: "notif-004",
    title: "Documento por vencer",
    message: "Certificado visual requiere revision antes de operar en obra.",
    category: "Documentos",
    severity: "Alta",
    status: "Nueva",
    audience: ["admin", "manager"],
    sourceModule: "documents",
    relatedLabel: visualDocuments[1].title,
    dueLabel: visualDocuments[1].expires,
  },
  {
    notificationId: "notif-005",
    title: "Mantenimiento programado",
    message: "Activo con mantenimiento visual pendiente en la agenda.",
    category: "Activos",
    severity: "Media",
    status: "Vista",
    audience: ["admin"],
    sourceModule: "assets",
    relatedLabel: assets[1].code,
    dueLabel: assets[1].maintenance[0].date,
  },
  {
    notificationId: "notif-006",
    title: "Cuota vence pronto",
    message: "Obligacion visual requiere revision antes del vencimiento.",
    category: "Activos",
    severity: "Alta",
    status: "Nueva",
    audience: ["admin"],
    sourceModule: "assets-liabilities",
    relatedLabel: liabilities[1].reference,
    dueLabel: liabilities[1].nextDueDate,
  },
  {
    notificationId: "notif-007",
    title: "Proteccion ocular requerida",
    message: workerDay.notifications[0],
    category: "Personal",
    severity: "Media",
    status: "Nueva",
    audience: ["worker"],
    sourceModule: "attendance",
    relatedLabel: workerDay.project,
    dueLabel: "Antes de iniciar",
  },
  {
    notificationId: "notif-008",
    title: "Evidencia final pendiente",
    message: workerDay.notifications[1],
    category: "Obras",
    severity: "Alta",
    status: "Nueva",
    audience: ["worker", "manager"],
    sourceModule: "work-proofs",
    relatedLabel: workerDay.project,
    dueLabel: "Fin de jornada",
  },
];

export const visualAuditEvents: VisualAuditEvent[] = [
  {
    auditId: "audit-001",
    date: "Jul 14, 2026 08:12",
    actor: "Admin Demo",
    role: "admin",
    action: "Abrio panel de finanzas",
    module: "finance",
    result: "Permitido visual",
    entity: "Finanzas",
  },
  {
    auditId: "audit-002",
    date: "Jul 14, 2026 08:18",
    actor: "Maria Torres",
    role: "manager",
    action: "Reviso gasto visual",
    module: "expenses",
    result: "Permitido visual",
    entity: expenses[0].billNumber,
  },
  {
    auditId: "audit-003",
    date: "Jul 14, 2026 08:25",
    actor: "Carlos Mendoza",
    role: "worker",
    action: "Consulto notificacion de jornada",
    module: "notifications",
    result: "Permitido visual",
    entity: workerDay.project,
  },
  {
    auditId: "audit-004",
    date: "Jul 14, 2026 08:31",
    actor: "Gestor Demo",
    role: "manager",
    action: "Intento ver pasivo restringido",
    module: "assets-liabilities",
    result: "Bloqueado visual",
    entity: liabilities[0].reference,
  },
  {
    auditId: "audit-005",
    date: "Jul 14, 2026 08:44",
    actor: "Admin Demo",
    role: "admin",
    action: "Abrio auditoria",
    module: "notifications",
    result: "Revision",
    entity: "Audit trail visual",
  },
];

export const visualReports: VisualReport[] = [
  {
    reportId: "report-001",
    title: "Estado ejecutivo semanal",
    owner: "Administrador",
    scope: "Finanzas, obras, facturas, gastos y alertas criticas",
    status: "Listo visual",
    cadence: "Semanal",
    sourceModules: ["finance", "jobs", "invoicing", "expenses"],
  },
  {
    reportId: "report-002",
    title: "Operacion de obras",
    owner: "Gestor de empresa",
    scope: "Trabajadores, asistencia, partes diarios y tareas bloqueadas",
    status: "Revision",
    cadence: "Diario",
    sourceModules: ["jobs", "attendance", "work-proofs", "workforce"],
  },
  {
    reportId: "report-003",
    title: "Riesgos documentales",
    owner: "Administrador",
    scope: "Documentos por vencer, garantias y contratos visuales",
    status: "Pendiente de datos",
    cadence: "Mensual",
    sourceModules: ["documents", "assets-liabilities"],
  },
];

export const notificationsSummary = {
  newItems: "5",
  criticalItems: "1",
  reviewItems: "2",
  visualChannels: "3",
};

export const auditSummary = {
  events: String(visualAuditEvents.length),
  blocked: "1",
  reviewed: "2",
  retained: "Visual",
};
