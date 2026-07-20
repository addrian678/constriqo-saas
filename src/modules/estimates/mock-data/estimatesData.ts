import { clients } from "../../crm/mock-data/crmData";

export type EstimateStatus = "Borrador" | "Enviada" | "En revision" | "Aprobada visualmente" | "Rechazada";

export type EstimateItem = {
  itemId: string;
  section: string;
  description: string;
  quantity: string;
  unit: string;
  amount: string;
};

export type EstimateActivity = {
  activityId: string;
  title: string;
  description: string;
  date: string;
};

export type Estimate = {
  estimateId: string;
  estimateNumber: string;
  clientId: string;
  title: string;
  projectType: string;
  status: EstimateStatus;
  language: "Espanol" | "English - United States";
  total: string;
  validUntil: string;
  responsibleName: string;
  scope: string;
  exclusions: string[];
  conditions: string[];
  items: EstimateItem[];
  activity: EstimateActivity[];
  versions: string[];
};

export const estimates: Estimate[] = [
  {
    estimateId: "estimate-001",
    estimateNumber: "Q-2026-014",
    clientId: clients[0].clientId,
    title: "Kitchen Renovation - Salt Lake City",
    projectType: "Kitchen Renovation",
    status: "En revision",
    language: "English - United States",
    total: "$18,950",
    validUntil: "Aug 15, 2026",
    responsibleName: "David Herrera",
    scope: "Renovacion visual de cocina con demolicion ligera, preparacion, acabados y limpieza final.",
    exclusions: ["Permisos municipales", "Cambios estructurales", "Materiales seleccionados fuera del alcance"],
    conditions: ["Precios simulados", "No genera PDF", "Aprobacion visual sin crear obra"],
    items: [
      { itemId: "item-001", section: "Labor", description: "Demolition and prep", quantity: "1", unit: "lot", amount: "$3,400" },
      { itemId: "item-002", section: "Materials", description: "Drywall, trim and finish materials", quantity: "1", unit: "lot", amount: "$7,850" },
      { itemId: "item-003", section: "Labor", description: "Installation and finishing crew", quantity: "84", unit: "hours", amount: "$7,700" },
    ],
    activity: [
      { activityId: "ea-001", title: "Vista previa revisada", description: "El gestor abrio la vista previa simulada.", date: "Hoy" },
      { activityId: "ea-002", title: "Partidas ajustadas", description: "Se reorganizaron secciones visuales.", date: "Ayer" },
    ],
    versions: ["v1 - Borrador inicial", "v2 - Alcance revisado"],
  },
  {
    estimateId: "estimate-002",
    estimateNumber: "Q-2026-015",
    clientId: clients[1].clientId,
    title: "Basement Remodeling - West Jordan",
    projectType: "Basement Remodeling",
    status: "Borrador",
    language: "Espanol",
    total: "$31,400",
    validUntil: "Aug 20, 2026",
    responsibleName: "Maria Torres",
    scope: "Remodelacion visual de sotano con preparacion, divisiones interiores y terminaciones.",
    exclusions: ["Ingenieria estructural", "Mobiliario", "Equipos HVAC nuevos"],
    conditions: ["Importes de demostracion", "Sin calculo fiscal real", "Sin envio por correo"],
    items: [
      { itemId: "item-004", section: "Preparacion", description: "Proteccion y limpieza inicial", quantity: "1", unit: "lote", amount: "$2,250" },
      { itemId: "item-005", section: "Construccion", description: "Framing y drywall", quantity: "1", unit: "lote", amount: "$16,900" },
      { itemId: "item-006", section: "Acabados", description: "Pintura, trim y puertas interiores", quantity: "1", unit: "lote", amount: "$12,250" },
    ],
    activity: [{ activityId: "ea-003", title: "Borrador creado", description: "Registro visual creado desde CRM.", date: "Hoy" }],
    versions: ["v1 - Borrador"],
  },
  {
    estimateId: "estimate-003",
    estimateNumber: "Q-2026-016",
    clientId: clients[2].clientId,
    title: "Bathroom Renovation - Provo",
    projectType: "Bathroom Renovation",
    status: "Aprobada visualmente",
    language: "English - United States",
    total: "$24,600",
    validUntil: "Aug 25, 2026",
    responsibleName: "David Herrera",
    scope: "Renovacion de banos con checklist visual de acabados y materiales.",
    exclusions: ["Plumbing hidden damage", "Permit fees", "Client supplied fixtures"],
    conditions: ["Approval does not create a job in V0.3", "Document preview only"],
    items: [
      { itemId: "item-007", section: "Labor", description: "Tile and finish crew", quantity: "72", unit: "hours", amount: "$8,900" },
      { itemId: "item-008", section: "Materials", description: "Tile, grout, fixtures allowance", quantity: "1", unit: "lot", amount: "$15,700" },
    ],
    activity: [
      { activityId: "ea-004", title: "Aprobacion visual", description: "Muestra aviso de obra futura, no crea registro real.", date: "Jul 12" },
    ],
    versions: ["v1 - Draft", "v2 - Client preview", "v3 - Visual approval"],
  },
];
