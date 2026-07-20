import { jobs } from "../../jobs/mock-data/jobsData";

export type WorkerStatus = "Activo" | "Disponible" | "Asignado" | "En descanso" | "Documento pendiente";
export type AvailabilityStatus = "Disponible" | "Asignado" | "No disponible";

export type WorkerDocument = {
  documentId: string;
  title: string;
  status: "Vigente" | "Por vencer" | "Pendiente";
  expires: string;
};

export type WorkerAssignment = {
  assignmentId: string;
  jobId: string;
  role: string;
  window: string;
  status: "Programada" | "Activa" | "Completada";
};

export type WorkforceMember = {
  workerId: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  status: WorkerStatus;
  availability: AvailabilityStatus;
  trade: string;
  skills: string[];
  certifications: string[];
  documents: WorkerDocument[];
  assignments: WorkerAssignment[];
  hourlyCostVisual: string;
  notes: string;
};

export const workforceMembers: WorkforceMember[] = [
  {
    workerId: "worker-001",
    name: "Carlos Mendoza",
    role: "Lead Carpenter",
    phone: "(801) 555-0181",
    email: "carlos.mendoza@example.com",
    status: "Asignado",
    availability: "Asignado",
    trade: "Carpinteria",
    skills: ["Framing", "Finish carpentry", "Drywall prep"],
    certifications: ["OSHA 10 visual", "Safety briefing"],
    documents: [
      { documentId: "wd-001", title: "ID laboral visual", status: "Vigente", expires: "Dec 31, 2026" },
      { documentId: "wd-002", title: "Certificacion OSHA visual", status: "Por vencer", expires: "Sep 15, 2026" },
    ],
    assignments: [
      {
        assignmentId: "assg-001",
        jobId: jobs[0].jobId,
        role: "Lead",
        window: "Jul 15 - Aug 02",
        status: "Activa",
      },
      {
        assignmentId: "assg-002",
        jobId: jobs[2].jobId,
        role: "Support",
        window: "Jul 22 - Aug 10",
        status: "Programada",
      },
    ],
    hourlyCostVisual: "$42/h",
    notes: "Asignado a trabajos activos. Coste solo visual, sin nomina ni calculo real.",
  },
  {
    workerId: "worker-002",
    name: "Daniel Rivera",
    role: "Drywall Specialist",
    phone: "(385) 555-0166",
    email: "daniel.rivera@example.com",
    status: "Activo",
    availability: "Disponible",
    trade: "Drywall",
    skills: ["Drywall install", "Texture", "Patch repair"],
    certifications: ["Safety briefing"],
    documents: [{ documentId: "wd-003", title: "W-9 visual", status: "Pendiente", expires: "Pendiente" }],
    assignments: [
      {
        assignmentId: "assg-003",
        jobId: jobs[0].jobId,
        role: "Installer",
        window: "Jul 17 - Jul 25",
        status: "Activa",
      },
    ],
    hourlyCostVisual: "$38/h",
    notes: "Disponible despues de la instalacion actual.",
  },
  {
    workerId: "worker-003",
    name: "Jose Ramirez",
    role: "Tile Installer",
    phone: "(801) 555-0134",
    email: "jose.ramirez@example.com",
    status: "Documento pendiente",
    availability: "Asignado",
    trade: "Tile",
    skills: ["Tile layout", "Grout", "Waterproofing"],
    certifications: ["Tool safety visual"],
    documents: [
      { documentId: "wd-004", title: "Seguro visual", status: "Por vencer", expires: "Aug 20, 2026" },
    ],
    assignments: [
      {
        assignmentId: "assg-004",
        jobId: jobs[1].jobId,
        role: "Installer",
        window: "Aug 06 - Aug 26",
        status: "Programada",
      },
      {
        assignmentId: "assg-005",
        jobId: jobs[2].jobId,
        role: "Installer",
        window: "Jul 24 - Aug 02",
        status: "Programada",
      },
    ],
    hourlyCostVisual: "$40/h",
    notes: "Revisar documento antes de asignaciones futuras.",
  },
  {
    workerId: "worker-004",
    name: "Kevin Morales",
    role: "General Labor",
    phone: "(801) 555-0119",
    email: "kevin.morales@example.com",
    status: "Disponible",
    availability: "Disponible",
    trade: "General",
    skills: ["Site prep", "Cleanup", "Material handling"],
    certifications: ["Safety briefing"],
    documents: [{ documentId: "wd-005", title: "Perfil laboral visual", status: "Vigente", expires: "Dec 31, 2026" }],
    assignments: [
      {
        assignmentId: "assg-006",
        jobId: jobs[1].jobId,
        role: "Support",
        window: "Aug 05 - Sep 04",
        status: "Programada",
      },
    ],
    hourlyCostVisual: "$29/h",
    notes: "Buen apoyo para preparacion, limpieza y traslado de materiales.",
  },
];

export const workforceCalendar = [
  { day: "Lun", slots: ["Carlos - Kitchen", "Daniel - Drywall"] },
  { day: "Mar", slots: ["Carlos - Kitchen", "Jose - Bathroom"] },
  { day: "Mie", slots: ["Kevin - Prep", "Daniel - Kitchen"] },
  { day: "Jue", slots: ["Jose - Tile", "Carlos - Review"] },
  { day: "Vie", slots: ["Kevin - Cleanup", "Equipo - Safety"] },
];
