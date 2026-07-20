import { jobs } from "../../jobs/mock-data/jobsData";
import { workforceMembers } from "../../workforce/mock-data/workforceData";

export type FieldReportStatus = "Borrador" | "Enviado" | "En revision" | "Aprobado visualmente" | "Requiere ajuste";
export type IncidentSeverity = "Baja" | "Media" | "Alta";

export type ChecklistItem = {
  checklistItemId: string;
  label: string;
  status: "Completado" | "Pendiente" | "No aplica";
};

export type MaterialUsed = {
  materialId: string;
  name: string;
  quantity: string;
  note: string;
};

export type WorkProof = {
  proofId: string;
  title: string;
  jobId: string;
  workerId: string;
  task: string;
  status: FieldReportStatus;
  date: string;
  initialEvidence: string;
  finalEvidence: string;
  observations: string;
  checklist: ChecklistItem[];
  materials: MaterialUsed[];
};

export type FieldIncident = {
  incidentId: string;
  jobId: string;
  workerId: string;
  title: string;
  severity: IncidentSeverity;
  status: "Abierta" | "En revision" | "Cerrada visualmente";
  description: string;
};

export type DailyReport = {
  reportId: string;
  jobId: string;
  date: string;
  weatherVisual: string;
  progressSummary: string;
  status: FieldReportStatus;
  crew: string[];
  proofs: WorkProof[];
  incidents: FieldIncident[];
};

export const workProofs: WorkProof[] = [
  {
    proofId: "proof-001",
    title: "Kitchen prep evidence",
    jobId: jobs[0].jobId,
    workerId: workforceMembers[0].workerId,
    task: "Protect area and validate drywall prep",
    status: "En revision",
    date: "Hoy",
    initialEvidence: "Placeholder antes",
    finalEvidence: "Placeholder despues",
    observations: "Area protegida y lista para instalacion. Evidencia visual sin archivo real.",
    checklist: [
      { checklistItemId: "ci-001", label: "Area protegida", status: "Completado" },
      { checklistItemId: "ci-002", label: "Materiales revisados", status: "Completado" },
      { checklistItemId: "ci-003", label: "Evidencia final", status: "Pendiente" },
    ],
    materials: [
      { materialId: "mat-001", name: "Plastic sheeting", quantity: "2 rolls", note: "Simulado" },
      { materialId: "mat-002", name: "Painter tape", quantity: "4 units", note: "Simulado" },
    ],
  },
  {
    proofId: "proof-002",
    title: "Bathroom demolition check",
    jobId: jobs[2].jobId,
    workerId: workforceMembers[2].workerId,
    task: "Document demolition progress",
    status: "Requiere ajuste",
    date: "Hoy",
    initialEvidence: "Placeholder inicial",
    finalEvidence: "Placeholder final",
    observations: "Falta confirmar material alternativo antes de cerrar la tarea.",
    checklist: [
      { checklistItemId: "ci-004", label: "Debris cleared", status: "Completado" },
      { checklistItemId: "ci-005", label: "Hidden damage noted", status: "Pendiente" },
      { checklistItemId: "ci-006", label: "Final photo", status: "Pendiente" },
    ],
    materials: [
      { materialId: "mat-003", name: "Demo bags", quantity: "8 units", note: "Visual" },
    ],
  },
];

export const fieldIncidents: FieldIncident[] = [
  {
    incidentId: "inc-001",
    jobId: jobs[0].jobId,
    workerId: workforceMembers[1].workerId,
    title: "Material delivery delayed",
    severity: "Media",
    status: "En revision",
    description: "La entrega de drywall llego tarde. Sin impacto real en calendario durante V0.7.",
  },
  {
    incidentId: "inc-002",
    jobId: jobs[2].jobId,
    workerId: workforceMembers[2].workerId,
    title: "Fixture mismatch",
    severity: "Alta",
    status: "Abierta",
    description: "El fixture recibido no coincide con la seleccion visual del cliente.",
  },
];

export const dailyReports: DailyReport[] = [
  {
    reportId: "daily-001",
    jobId: jobs[0].jobId,
    date: "Hoy",
    weatherVisual: "Clear, 84 F",
    progressSummary: "Preparacion completa y drywall en progreso.",
    status: "En revision",
    crew: [workforceMembers[0].name, workforceMembers[1].name],
    proofs: [workProofs[0]],
    incidents: [fieldIncidents[0]],
  },
  {
    reportId: "daily-002",
    jobId: jobs[2].jobId,
    date: "Hoy",
    weatherVisual: "Indoor work",
    progressSummary: "Demolicion avanzada con cambio pendiente.",
    status: "Requiere ajuste",
    crew: [workforceMembers[0].name, workforceMembers[2].name],
    proofs: [workProofs[1]],
    incidents: [fieldIncidents[1]],
  },
];
