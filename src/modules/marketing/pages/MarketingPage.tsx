import { Megaphone, MousePointerClick, Search, Star, Users } from "lucide-react";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { marketingCampaigns, marketingLeads, marketingSummary, type MarketingLeadStatus } from "../mock-data/marketingData";

const leadTone: Record<MarketingLeadStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Nuevo: "info",
  Contactado: "warning",
  Calificado: "success",
  Convertido: "success",
  Descartado: "neutral",
};

type MarketingPageProps = {
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function MarketingPage({ roleLabel }: MarketingPageProps) {
  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - F3.5`}
        title="Marketing"
        description="Campanas, leads, formularios, seguimientos, reputacion y metricas preparadas. Sin anuncios externos ni envios masivos reales."
      />

      <section className="grid stats-grid">
        <StatCard label="Campanas" value={marketingSummary.campaigns} note="Activas/preparadas" tone="info" icon={Megaphone} />
        <StatCard label="Leads" value={marketingSummary.leads} note="Marketing" tone="positive" icon={Users} />
        <StatCard label="Calificados" value={marketingSummary.qualified} note="Listos para CRM" tone="warning" icon={MousePointerClick} />
        <StatCard label="Conversiones" value={marketingSummary.conversions} note="Manual" tone="danger" icon={Star} />
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Campanas</h2>
              <p className="activity-meta">Presupuesto y conversiones son internos; no hay integracion con ads.</p>
            </div>
            <StatusBadge label="Sin APIs externas" tone="neutral" />
          </div>
          <div className="responsive-table">
            <div className="table-header marketing-campaign-grid">
              <span>Campana</span>
              <span>Canal</span>
              <span>Leads</span>
              <span>Conversiones</span>
            </div>
            {marketingCampaigns.map((campaign) => (
              <article className="table-row marketing-campaign-grid" key={campaign.campaignId}>
                <div>
                  <strong>{campaign.name}</strong>
                  <p className="activity-meta">{campaign.status} - {campaign.budget}</p>
                </div>
                <span>{campaign.channel}</span>
                <strong>{campaign.leads}</strong>
                <strong>{campaign.conversions}</strong>
              </article>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Formularios y consentimiento</h2>
            <Search size={20} />
          </div>
          <div className="grid proof-grid">
            <VisualField label="Solicitud cotizacion" value="Preparada" />
            <VisualField label="Contacto web" value="Preparado" />
            <VisualField label="Anti-spam" value="Pendiente runtime" />
            <VisualField label="Consentimiento" value="Obligatorio" />
            <VisualField label="Email/SMS" value="No activo" />
            <VisualField label="Conversion a CRM" value="Preparada" />
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Leads de marketing</h2>
            <p className="activity-meta">Los leads calificados podran convertirse a CRM sin duplicar contactos.</p>
          </div>
          <StatusBadge label="Consentimiento primero" tone="warning" />
        </div>
        <div className="responsive-table">
          <div className="table-header marketing-leads-grid">
            <span>Lead</span>
            <span>Fuente</span>
            <span>Servicio</span>
            <span>Estado</span>
            <span>Consentimiento</span>
          </div>
          {marketingLeads.map((lead) => (
            <article className="table-row marketing-leads-grid" key={lead.leadId}>
              <strong>{lead.name}</strong>
              <span>{lead.source}</span>
              <span>{lead.service}</span>
              <StatusBadge label={lead.status} tone={leadTone[lead.status]} />
              <StatusBadge label={lead.consent} tone={lead.consent === "Pendiente" ? "warning" : "success"} />
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
