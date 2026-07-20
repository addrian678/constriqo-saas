export type MarketingLeadStatus = "Nuevo" | "Contactado" | "Calificado" | "Convertido" | "Descartado";

export const marketingCampaigns = [
  {
    campaignId: "campaign-001",
    name: "Kitchen remodel summer",
    channel: "Landing local",
    status: "Activa",
    budget: "$850",
    leads: 14,
    conversions: 3,
  },
  {
    campaignId: "campaign-002",
    name: "Referidos clientes actuales",
    channel: "Referidos",
    status: "Activa",
    budget: "$0",
    leads: 8,
    conversions: 4,
  },
  {
    campaignId: "campaign-003",
    name: "Servicios recurrentes de aseo",
    channel: "Preparado Aseo",
    status: "Preparada",
    budget: "$300",
    leads: 0,
    conversions: 0,
  },
];

export const marketingLeads: Array<{
  leadId: string;
  name: string;
  source: string;
  service: string;
  status: MarketingLeadStatus;
  consent: string;
}> = [
  {
    leadId: "mlead-001",
    name: "Olivia Carter",
    source: "Landing cocina",
    service: "Kitchen renovation",
    status: "Calificado",
    consent: "Contacto permitido",
  },
  {
    leadId: "mlead-002",
    name: "Bright Office LLC",
    source: "Formulario web",
    service: "Limpieza recurrente",
    status: "Nuevo",
    consent: "Pendiente",
  },
  {
    leadId: "mlead-003",
    name: "Mateo Ruiz",
    source: "Referido",
    service: "Bathroom renovation",
    status: "Convertido",
    consent: "Contacto permitido",
  },
];

export const marketingSummary = {
  campaigns: String(marketingCampaigns.length),
  leads: String(marketingLeads.length),
  qualified: "1",
  conversions: "7",
};
