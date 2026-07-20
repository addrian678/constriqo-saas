import { cleaningProfileContract, constructionProfile } from "../../../verticals/construction/terminology/terms";

export type ReadinessStatus = "Compatible visual" | "Requiere adaptacion" | "No activar en V0";
export type ValidationRisk = "Bajo" | "Medio" | "Alto";

export type TerminologyComparison = {
  area: string;
  construction: string;
  cleaning: string;
  status: ReadinessStatus;
};

export type ModuleReadiness = {
  moduleId: string;
  constructionUse: string;
  cleaningUse: string;
  status: ReadinessStatus;
  risk: ValidationRisk;
};

export type SectorScenario = {
  scenarioId: string;
  title: string;
  constructionFlow: string;
  cleaningFlow: string;
  decision: string;
};

export const industryProfiles = [constructionProfile, cleaningProfileContract];

export const terminologyComparisons: TerminologyComparison[] = [
  {
    area: "Entidad de trabajo",
    construction: constructionProfile.workEntitySingular,
    cleaning: cleaningProfileContract.workEntitySingular,
    status: "Compatible visual",
  },
  {
    area: "Listado operativo",
    construction: constructionProfile.workEntityPlural,
    cleaning: cleaningProfileContract.workEntityPlural,
    status: "Compatible visual",
  },
  {
    area: "Persona de campo",
    construction: constructionProfile.workerLabel,
    cleaning: cleaningProfileContract.workerLabel,
    status: "Compatible visual",
  },
  {
    area: "Prueba de trabajo",
    construction: "Fotos, materiales, incidentes y parte diario",
    cleaning: "Checklist, evidencia antes/despues, incidencias y firma visual",
    status: "Requiere adaptacion",
  },
  {
    area: "Cotizacion",
    construction: "Alcance, partidas, materiales y condiciones",
    cleaning: "Frecuencia, zonas, insumos, SLA y condiciones",
    status: "Requiere adaptacion",
  },
  {
    area: "Activo",
    construction: "Vehiculos, herramientas y equipos",
    cleaning: "Equipos, productos, carros, aspiradoras y consumibles",
    status: "Requiere adaptacion",
  },
];

export const moduleReadiness: ModuleReadiness[] = [
  {
    moduleId: "crm",
    constructionUse: "Clientes, prospectos y propiedades",
    cleaningUse: "Clientes, sedes, contactos y frecuencia de servicio",
    status: "Compatible visual",
    risk: "Bajo",
  },
  {
    moduleId: "estimates",
    constructionUse: "Cotizaciones por alcance y partidas",
    cleaningUse: "Propuestas por frecuencia, zonas y turnos",
    status: "Requiere adaptacion",
    risk: "Medio",
  },
  {
    moduleId: "jobs",
    constructionUse: "Obras con fases, tareas y cambios",
    cleaningUse: "Servicios recurrentes, rutas y checklist",
    status: "Requiere adaptacion",
    risk: "Alto",
  },
  {
    moduleId: "workforce",
    constructionUse: "Trabajadores por obra",
    cleaningUse: "Operarios por turno y sede",
    status: "Compatible visual",
    risk: "Bajo",
  },
  {
    moduleId: "attendance",
    constructionUse: "Entrada/salida por obra",
    cleaningUse: "Entrada/salida por sede o ruta",
    status: "Compatible visual",
    risk: "Medio",
  },
  {
    moduleId: "work-proofs",
    constructionUse: "Parte diario, pruebas y materiales",
    cleaningUse: "Checklist, evidencia de calidad e incidencias",
    status: "Requiere adaptacion",
    risk: "Alto",
  },
  {
    moduleId: "documents",
    constructionUse: "Alcances, seguros, ordenes de cambio",
    cleaningUse: "Contratos, protocolos, fichas de productos",
    status: "Compatible visual",
    risk: "Bajo",
  },
  {
    moduleId: "finance",
    constructionUse: "Facturas, gastos, caja y rentabilidad",
    cleaningUse: "Facturacion recurrente, insumos, margen por contrato",
    status: "Requiere adaptacion",
    risk: "Medio",
  },
];

export const sectorScenarios: SectorScenario[] = [
  {
    scenarioId: "scenario-001",
    title: "Servicio recurrente de oficina",
    constructionFlow: "Obra unica con fases y cierre",
    cleaningFlow: "Servicio semanal con checklist, ruta y evidencia periodica",
    decision: "El modulo jobs debe aceptar recurrencia sin duplicar la entidad base.",
  },
  {
    scenarioId: "scenario-002",
    title: "Evidencia de calidad",
    constructionFlow: "Fotos de avance, incidentes y materiales usados",
    cleaningFlow: "Antes/despues, checklist por zona y firma visual del cliente",
    decision: "work-proofs necesita plantillas por perfil sectorial.",
  },
  {
    scenarioId: "scenario-003",
    title: "Cotizacion con frecuencia",
    constructionFlow: "Partidas por material/mano de obra",
    cleaningFlow: "Precio por frecuencia, superficie, turno e insumos",
    decision: "estimates debe soportar line items por perfil sin romper totales comunes.",
  },
];

export const validationSummary = {
  profiles: String(industryProfiles.length),
  compatible: "4",
  adaptations: "4",
  blocked: "1",
};
