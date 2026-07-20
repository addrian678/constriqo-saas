import { jobs } from "../../jobs/mock-data/jobsData";
import { workforceMembers } from "../../workforce/mock-data/workforceData";

export type TimeEntryStatus =
  | "Jornada no iniciada"
  | "Jornada activa"
  | "En descanso"
  | "Jornada terminada"
  | "Pendiente de revision"
  | "Excepcion";

export type PerimeterStatus = "Dentro del perimetro" | "Fuera del perimetro" | "Ubicacion imprecisa" | "Sin conexion";

export type TimeEntry = {
  timeEntryId: string;
  workerId: string;
  jobId: string;
  date: string;
  expectedSchedule: string;
  checkIn: string;
  breakStart: string;
  breakEnd: string;
  checkOut: string;
  totalVisual: string;
  status: TimeEntryStatus;
  perimeterStatus: PerimeterStatus;
  reviewStatus: "Aprobada visualmente" | "Pendiente" | "Requiere ajuste";
  exceptionReason?: string;
  reviewer: string;
};

export const timeEntries: TimeEntry[] = [
  {
    timeEntryId: "time-001",
    workerId: workforceMembers[0].workerId,
    jobId: jobs[0].jobId,
    date: "Hoy",
    expectedSchedule: "08:00 AM - 04:30 PM",
    checkIn: "08:02 AM",
    breakStart: "12:10 PM",
    breakEnd: "12:42 PM",
    checkOut: "Pendiente",
    totalVisual: "4.1 h",
    status: "Jornada activa",
    perimeterStatus: "Dentro del perimetro",
    reviewStatus: "Pendiente",
    reviewer: "David Herrera",
  },
  {
    timeEntryId: "time-002",
    workerId: workforceMembers[1].workerId,
    jobId: jobs[0].jobId,
    date: "Hoy",
    expectedSchedule: "07:30 AM - 03:30 PM",
    checkIn: "07:48 AM",
    breakStart: "11:55 AM",
    breakEnd: "12:20 PM",
    checkOut: "03:38 PM",
    totalVisual: "7.4 h",
    status: "Pendiente de revision",
    perimeterStatus: "Ubicacion imprecisa",
    reviewStatus: "Requiere ajuste",
    exceptionReason: "Entrada con precision baja",
    reviewer: "David Herrera",
  },
  {
    timeEntryId: "time-003",
    workerId: workforceMembers[2].workerId,
    jobId: jobs[2].jobId,
    date: "Ayer",
    expectedSchedule: "08:00 AM - 04:00 PM",
    checkIn: "08:11 AM",
    breakStart: "12:00 PM",
    breakEnd: "12:30 PM",
    checkOut: "04:04 PM",
    totalVisual: "7.4 h",
    status: "Jornada terminada",
    perimeterStatus: "Dentro del perimetro",
    reviewStatus: "Aprobada visualmente",
    reviewer: "Maria Torres",
  },
  {
    timeEntryId: "time-004",
    workerId: workforceMembers[3].workerId,
    jobId: jobs[1].jobId,
    date: "Ayer",
    expectedSchedule: "09:00 AM - 02:00 PM",
    checkIn: "Sin conexion",
    breakStart: "No aplica",
    breakEnd: "No aplica",
    checkOut: "02:05 PM",
    totalVisual: "5.0 h",
    status: "Excepcion",
    perimeterStatus: "Sin conexion",
    reviewStatus: "Pendiente",
    exceptionReason: "Registro visual sin conexion",
    reviewer: "David Herrera",
  },
];

export const workerAttendanceStates = [
  "Trabajo asignado",
  "Hora del servidor simulada",
  "Ubicacion puntual visual",
  "Distancia visual al lugar",
  "Confirmacion del trabajador",
  "QR o NFC opcional futuro",
  "Fotografia opcional futura",
  "Revision del gestor",
];

export const attendanceReviewQueue = timeEntries.filter((entry) => entry.reviewStatus !== "Aprobada visualmente");
