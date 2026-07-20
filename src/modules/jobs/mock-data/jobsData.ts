import { clients } from "../../crm/mock-data/crmData";
import { estimates } from "../../estimates/mock-data/estimatesData";
import { workers } from "../../../mock-data/company";

export type JobStatus = "Planificada" | "En progreso" | "En pausa" | "Pendiente de cambio" | "Cerrada visualmente";
export type JobPriority = "Normal" | "Alta" | "Revision";

export type JobTask = {
  taskId: string;
  title: string;
  owner: string;
  status: "Pendiente" | "En curso" | "Bloqueada" | "Completada";
};

export type JobPhase = {
  phaseId: string;
  title: string;
  window: string;
  progress: string;
  status: "Pendiente" | "Activa" | "Completada";
};

export type Job = {
  jobId: string;
  jobNumber: string;
  clientId: string;
  estimateId: string;
  title: string;
  address: string;
  supervisor: string;
  status: JobStatus;
  priority: JobPriority;
  scheduledWindow: string;
  budgetVisual: string;
  team: string[];
  scope: string;
  phases: JobPhase[];
  tasks: JobTask[];
  documents: string[];
  changeRequests: string[];
  incidents: string[];
};

export const jobs: Job[] = [
  {
    jobId: "job-001",
    jobNumber: "JOB-2026-021",
    clientId: clients[0].clientId,
    estimateId: estimates[0].estimateId,
    title: "Kitchen Renovation - Salt Lake City",
    address: "248 E 900 S, Salt Lake City, UT",
    supervisor: "David Herrera",
    status: "En progreso",
    priority: "Alta",
    scheduledWindow: "Jul 15 - Aug 02, 2026",
    budgetVisual: "$18,950",
    team: [workers[0], workers[1]],
    scope: "Renovacion de cocina con preparacion, drywall, acabados y limpieza final.",
    phases: [
      { phaseId: "phase-001", title: "Preparacion", window: "Jul 15 - Jul 16", progress: "100%", status: "Completada" },
      { phaseId: "phase-002", title: "Instalacion", window: "Jul 17 - Jul 25", progress: "45%", status: "Activa" },
      { phaseId: "phase-003", title: "Acabados", window: "Jul 26 - Aug 02", progress: "0%", status: "Pendiente" },
    ],
    tasks: [
      { taskId: "task-001", title: "Proteger area de trabajo", owner: workers[0], status: "Completada" },
      { taskId: "task-002", title: "Instalar drywall", owner: workers[1], status: "En curso" },
      { taskId: "task-003", title: "Validar materiales de acabado", owner: "David Herrera", status: "Pendiente" },
    ],
    documents: ["Alcance aprobado visual", "Plano de referencia", "Checklist de seguridad"],
    changeRequests: ["Ajuste visual de gabinete superior"],
    incidents: ["Entrega de material retrasada - sin impacto real"],
  },
  {
    jobId: "job-002",
    jobNumber: "JOB-2026-022",
    clientId: clients[1].clientId,
    estimateId: estimates[1].estimateId,
    title: "Basement Remodeling - West Jordan",
    address: "712 W 7800 S, West Jordan, UT",
    supervisor: "Maria Torres",
    status: "Planificada",
    priority: "Normal",
    scheduledWindow: "Aug 05 - Sep 04, 2026",
    budgetVisual: "$31,400",
    team: [workers[2], workers[3]],
    scope: "Remodelacion visual de sotano con framing, drywall, pintura y trim.",
    phases: [
      { phaseId: "phase-004", title: "Medicion final", window: "Aug 05", progress: "0%", status: "Pendiente" },
      { phaseId: "phase-005", title: "Construccion", window: "Aug 06 - Aug 26", progress: "0%", status: "Pendiente" },
      { phaseId: "phase-006", title: "Cierre visual", window: "Aug 27 - Sep 04", progress: "0%", status: "Pendiente" },
    ],
    tasks: [
      { taskId: "task-004", title: "Confirmar acceso", owner: "David Herrera", status: "Pendiente" },
      { taskId: "task-005", title: "Reservar equipo", owner: workers[2], status: "Pendiente" },
    ],
    documents: ["Cotizacion Q-2026-015", "Fotos de referencia simuladas"],
    changeRequests: [],
    incidents: [],
  },
  {
    jobId: "job-003",
    jobNumber: "JOB-2026-023",
    clientId: clients[2].clientId,
    estimateId: estimates[2].estimateId,
    title: "Bathroom Renovation - Provo",
    address: "915 N University Ave, Provo, UT",
    supervisor: "David Herrera",
    status: "Pendiente de cambio",
    priority: "Revision",
    scheduledWindow: "Jul 22 - Aug 10, 2026",
    budgetVisual: "$24,600",
    team: [workers[0], workers[2]],
    scope: "Renovacion de bano con tile, fixtures y terminaciones.",
    phases: [
      { phaseId: "phase-007", title: "Demolicion", window: "Jul 22 - Jul 23", progress: "80%", status: "Activa" },
      { phaseId: "phase-008", title: "Tile", window: "Jul 24 - Aug 02", progress: "0%", status: "Pendiente" },
      { phaseId: "phase-009", title: "Punch list", window: "Aug 03 - Aug 10", progress: "0%", status: "Pendiente" },
    ],
    tasks: [
      { taskId: "task-006", title: "Registrar incidencia de material", owner: workers[0], status: "Bloqueada" },
      { taskId: "task-007", title: "Revisar orden de cambio", owner: "Maria Torres", status: "En curso" },
    ],
    documents: ["Cotizacion Q-2026-016", "Orden de cambio visual"],
    changeRequests: ["Cliente solicita cambiar fixture principal"],
    incidents: ["Material alternativo pendiente de aprobacion visual"],
  },
];
