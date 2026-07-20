export type LeadStatus = "Nuevo" | "Contactado" | "Visita programada" | "Cotizacion solicitada";
export type ClientStatus = "Activo" | "En seguimiento" | "Inactivo";

export type Lead = {
  leadId: string;
  name: string;
  source: string;
  projectType: string;
  address: string;
  estimatedValue: string;
  responsibleUserId: string;
  responsibleName: string;
  status: LeadStatus;
  nextAction: string;
};

export type Client = {
  clientId: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  status: ClientStatus;
  openOpportunities: number;
  lastActivity: string;
  responsibleUserId: string;
  responsibleName: string;
};

export type CrmActivity = {
  activityId: string;
  clientId: string;
  title: string;
  description: string;
  date: string;
  type: "Llamada" | "Correo" | "Visita" | "Nota";
};

export const leads: Lead[] = [
  {
    leadId: "lead-001",
    name: "Harper Residence",
    source: "Referido",
    projectType: "Kitchen Renovation",
    address: "Salt Lake City, UT",
    estimatedValue: "$18,500",
    responsibleUserId: "user-manager-001",
    responsibleName: "David Herrera",
    status: "Cotizacion solicitada",
    nextAction: "Preparar alcance inicial",
  },
  {
    leadId: "lead-002",
    name: "Miller Family",
    source: "Web",
    projectType: "Deck Construction",
    address: "Draper, UT",
    estimatedValue: "$12,800",
    responsibleUserId: "user-manager-001",
    responsibleName: "David Herrera",
    status: "Visita programada",
    nextAction: "Visita el jueves 10:00 AM",
  },
  {
    leadId: "lead-003",
    name: "Oakridge Apartments",
    source: "Llamada",
    projectType: "Bathroom Renovation",
    address: "Provo, UT",
    estimatedValue: "$24,000",
    responsibleUserId: "user-admin-001",
    responsibleName: "Maria Torres",
    status: "Contactado",
    nextAction: "Confirmar presupuesto disponible",
  },
  {
    leadId: "lead-004",
    name: "Jensen Basement",
    source: "Referido",
    projectType: "Basement Remodeling",
    address: "West Jordan, UT",
    estimatedValue: "$31,400",
    responsibleUserId: "user-manager-001",
    responsibleName: "David Herrera",
    status: "Nuevo",
    nextAction: "Primera llamada",
  },
];

export const clients: Client[] = [
  {
    clientId: "client-001",
    name: "Canyon Home Group",
    contactName: "Emily Harper",
    phone: "(801) 555-0148",
    email: "emily.harper@example.com",
    address: "248 E 900 S, Salt Lake City, UT",
    status: "Activo",
    openOpportunities: 2,
    lastActivity: "Solicitud de cotizacion para cocina",
    responsibleUserId: "user-manager-001",
    responsibleName: "David Herrera",
  },
  {
    clientId: "client-002",
    name: "Wasatch Property Partners",
    contactName: "Noah Miller",
    phone: "(801) 555-0192",
    email: "noah.miller@example.com",
    address: "712 W 7800 S, West Jordan, UT",
    status: "En seguimiento",
    openOpportunities: 1,
    lastActivity: "Visita tecnica pendiente",
    responsibleUserId: "user-admin-001",
    responsibleName: "Maria Torres",
  },
  {
    clientId: "client-003",
    name: "Provo Rental Homes",
    contactName: "Sofia Jensen",
    phone: "(385) 555-0120",
    email: "sofia.jensen@example.com",
    address: "915 N University Ave, Provo, UT",
    status: "Activo",
    openOpportunities: 3,
    lastActivity: "Revision de alcance de banos",
    responsibleUserId: "user-manager-001",
    responsibleName: "David Herrera",
  },
  {
    clientId: "client-004",
    name: "Draper Outdoor Living",
    contactName: "Liam Brooks",
    phone: "(801) 555-0175",
    email: "liam.brooks@example.com",
    address: "1342 E Pioneer Rd, Draper, UT",
    status: "Inactivo",
    openOpportunities: 0,
    lastActivity: "Proyecto cerrado visualmente",
    responsibleUserId: "user-admin-001",
    responsibleName: "Maria Torres",
  },
];

export const crmActivities: CrmActivity[] = [
  {
    activityId: "activity-001",
    clientId: "client-001",
    title: "Llamada de alcance",
    description: "El cliente quiere separar materiales, mano de obra y exclusiones.",
    date: "Hoy",
    type: "Llamada",
  },
  {
    activityId: "activity-002",
    clientId: "client-001",
    title: "Nota interna",
    description: "Revisar disponibilidad de Carlos Mendoza para medicion inicial.",
    date: "Ayer",
    type: "Nota",
  },
  {
    activityId: "activity-003",
    clientId: "client-002",
    title: "Correo de seguimiento",
    description: "Se envio resumen visual de proxima visita. Sin correo real.",
    date: "Jul 12",
    type: "Correo",
  },
  {
    activityId: "activity-004",
    clientId: "client-003",
    title: "Visita tecnica",
    description: "Pendiente validar medidas del bano principal.",
    date: "Jul 11",
    type: "Visita",
  },
];
