import { clients } from "../../crm/mock-data/crmData";
import { estimates } from "../../estimates/mock-data/estimatesData";
import { jobs } from "../../jobs/mock-data/jobsData";
import { workforceMembers } from "../../workforce/mock-data/workforceData";

export type DocumentStatus = "Vigente" | "Por vencer" | "Pendiente de revision" | "Archivado visual";
export type DocumentSensitivity = "Publico interno" | "Cliente" | "Restringido" | "Trabajador autorizado";
export type DocumentEntityType = "Cliente" | "Obra" | "Trabajador" | "Cotizacion";

export type VisualDocument = {
  documentId: string;
  title: string;
  folder: string;
  type: string;
  status: DocumentStatus;
  sensitivity: DocumentSensitivity;
  relatedEntityType: DocumentEntityType;
  relatedEntityId: string;
  relatedEntityLabel: string;
  owner: string;
  expires: string;
  version: string;
  tags: string[];
  summary: string;
};

export const visualDocuments: VisualDocument[] = [
  {
    documentId: "doc-001",
    title: "Kitchen Renovation - Scope signed visual",
    folder: "Clientes / Alcances",
    type: "Alcance",
    status: "Pendiente de revision",
    sensitivity: "Cliente",
    relatedEntityType: "Cotizacion",
    relatedEntityId: estimates[0].estimateId,
    relatedEntityLabel: estimates[0].estimateNumber,
    owner: "David Herrera",
    expires: "No vence",
    version: "v2",
    tags: ["scope", "estimate", "client"],
    summary: "Documento visual relacionado con la cotizacion. No hay PDF real ni archivo almacenado.",
  },
  {
    documentId: "doc-002",
    title: "Insurance certificate - Jose Ramirez",
    folder: "Trabajadores / Certificaciones",
    type: "Seguro",
    status: "Por vencer",
    sensitivity: "Restringido",
    relatedEntityType: "Trabajador",
    relatedEntityId: workforceMembers[2].workerId,
    relatedEntityLabel: workforceMembers[2].name,
    owner: "Maria Torres",
    expires: "Aug 20, 2026",
    version: "v1",
    tags: ["worker", "insurance", "expiration"],
    summary: "Metadata visual para documento de trabajador. La validacion real queda para F1/F2.",
  },
  {
    documentId: "doc-003",
    title: "Bathroom Renovation - Change request visual",
    folder: "Obras / Ordenes de cambio",
    type: "Orden de cambio",
    status: "Vigente",
    sensitivity: "Cliente",
    relatedEntityType: "Obra",
    relatedEntityId: jobs[2].jobId,
    relatedEntityLabel: jobs[2].jobNumber,
    owner: "David Herrera",
    expires: "No vence",
    version: "v1",
    tags: ["job", "change-request", "construction"],
    summary: "Placeholder de orden de cambio sin firma, generacion PDF ni aprobacion real.",
  },
  {
    documentId: "doc-004",
    title: "Canyon Home Group - Contact packet",
    folder: "Clientes / Paquetes",
    type: "Paquete cliente",
    status: "Vigente",
    sensitivity: "Cliente",
    relatedEntityType: "Cliente",
    relatedEntityId: clients[0].clientId,
    relatedEntityLabel: clients[0].name,
    owner: "Maria Torres",
    expires: "No vence",
    version: "v3",
    tags: ["client", "contact", "packet"],
    summary: "Ficha documental visual vinculada a CRM. No contiene archivo real.",
  },
  {
    documentId: "doc-005",
    title: "Safety checklist template visual",
    folder: "Operaciones / Plantillas",
    type: "Plantilla",
    status: "Archivado visual",
    sensitivity: "Publico interno",
    relatedEntityType: "Obra",
    relatedEntityId: jobs[0].jobId,
    relatedEntityLabel: jobs[0].jobNumber,
    owner: "David Herrera",
    expires: "Revisar Sep 01, 2026",
    version: "v1",
    tags: ["template", "safety", "field"],
    summary: "Plantilla visual para operaciones de campo. Las plantillas reales se versionaran en F2.14.",
  },
];

export const documentFolders = [
  "Clientes / Alcances",
  "Clientes / Paquetes",
  "Obras / Ordenes de cambio",
  "Trabajadores / Certificaciones",
  "Operaciones / Plantillas",
];
