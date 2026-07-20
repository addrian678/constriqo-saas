import { projects, workers } from "../../../mock-data/company";

export const adminStats = [
  { label: "Saldo disponible", value: "$84,250", note: "Cuenta operativa", tone: "positive" },
  { label: "Ingresos del mes", value: "$42,700", note: "Simulado", tone: "positive" },
  { label: "Egresos del mes", value: "$26,430", note: "Simulado", tone: "warning" },
  { label: "Beneficio estimado", value: "$16,270", note: "Sin calculo real", tone: "positive" },
  { label: "Pendiente por cobrar", value: "$18,950", note: "Facturas abiertas", tone: "info" },
  { label: "Pendiente por pagar", value: "$7,840", note: "Proveedores", tone: "warning" },
  { label: "Obras activas", value: "4", note: "En seguimiento", tone: "info" },
  { label: "Horas por revisar", value: "18", note: "Control horario", tone: "danger" },
] as const;

export const managerStats = [
  { label: "Obras activas", value: "4", note: "Plan semanal", tone: "info" },
  { label: "Trabajos programados", value: "9", note: "Proximos 7 dias", tone: "positive" },
  { label: "Cotizaciones pendientes", value: "5", note: "Requieren seguimiento", tone: "warning" },
  { label: "Trabajadores asignados", value: String(workers.length), note: "Equipo actual", tone: "info" },
  { label: "Horas por aprobar", value: "12", note: "Entradas simuladas", tone: "danger" },
  { label: "Partes diarios pendientes", value: "6", note: "Por completar", tone: "warning" },
  { label: "Facturas pendientes", value: "3", note: "Sin gestion financiera real", tone: "info" },
  { label: "Proximas actividades", value: "7", note: "Agenda visual", tone: "positive" },
] as const;

export const adminActivity = [
  {
    title: "Cotizacion enviada",
    meta: "Bathroom Renovation - Provo",
    status: "Pendiente",
    tone: "warning",
  },
  {
    title: "Horas reportadas",
    meta: "Carlos Mendoza - Kitchen Renovation",
    status: "Revision",
    tone: "info",
  },
  {
    title: "Factura registrada",
    meta: "Basement Remodeling - West Jordan",
    status: "Abierta",
    tone: "neutral",
  },
] as const;

export const managerActivities = [
  {
    title: "Visita programada",
    meta: projects[0],
    status: "Hoy",
    tone: "success",
  },
  {
    title: "Parte diario pendiente",
    meta: projects[1],
    status: "Pendiente",
    tone: "warning",
  },
  {
    title: "Trabajo reasignado",
    meta: `${workers[1]} - ${projects[3]}`,
    status: "Nuevo",
    tone: "info",
  },
] as const;

export const workerDay = {
  worker: "Carlos Mendoza",
  project: projects[0],
  address: "248 E 900 S, Salt Lake City, UT",
  schedule: "08:00 AM - 04:30 PM",
  supervisor: "David Herrera",
  dayStatus: "Jornada no iniciada",
  weekHours: "31.5 h",
  pendingProofs: 2,
  notifications: [
    "Usar proteccion ocular en el area de corte.",
    "Enviar evidencia final antes de salir de la obra.",
  ],
};

export const attendanceStates = [
  ["Dentro del perimetro", "La ubicacion simulada coincide con la obra.", "success"],
  ["Fuera del perimetro", "Requiere revision manual del gestor.", "danger"],
  ["Ubicacion imprecisa", "Precision estimada insuficiente.", "warning"],
  ["Verificacion adicional requerida", "QR, NFC o fotografia podrian solicitarse despues.", "warning"],
  ["Entrada confirmada", "Registro visual aprobado en la maqueta.", "success"],
  ["Pendiente de revision", "El gestor debe validar la entrada.", "info"],
  ["Sin conexion", "El registro quedaria en cola en una fase futura.", "neutral"],
] as const;

export const workerVisualStates = [
  "Sin trabajo asignado",
  "Trabajo proximo",
  "Jornada no iniciada",
  "Jornada activa",
  "En descanso",
  "Jornada terminada",
  "Entrada pendiente de revision",
];
