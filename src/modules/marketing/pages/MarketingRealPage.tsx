import { CheckCircle2, Megaphone, MousePointerClick, Plus, RefreshCw, Save, Stamp, Users } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { AuthenticatedSession } from "../../../app/auth/authClient";
import { Button } from "../../../shared/components/Button";
import { BasicModal } from "../../../shared/components/BasicModal";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { QrCodeSvg } from "../../../shared/components/QrCodeSvg";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import {
  convertMarketingLead,
  createMarketingCampaign,
  createMarketingLead,
  createMarketingLoyaltyCard,
  listMarketingCampaigns,
  listMarketingLoyaltyCards,
  listMarketingLeads,
  updateMarketingLoyaltyCard,
  type CampaignInput,
  type CampaignStatus,
  type ConsentStatus,
  type LeadInput,
  type LeadStatus,
  type LoyaltyCardInput,
  type LoyaltyRewardType,
  type MarketingCampaign,
  type MarketingLead,
  type MarketingLoyaltyCard,
} from "../api/marketingClient";

type MarketingRealPageProps = {
  session: AuthenticatedSession;
};

const initialCampaign: CampaignInput = {
  name: "",
  channel: "manual",
  status: "draft",
  budgetAmount: 0,
};

const initialLead: LeadInput = {
  campaignId: "",
  name: "",
  source: "manual",
  serviceInterest: "",
  status: "new",
  consentStatus: "pending",
  email: "",
  phone: "",
  notes: "",
};

const initialLoyaltyCard: LoyaltyCardInput = {
  title: "Tarjeta de fidelizacion",
  customerName: "",
  customerPhone: "",
  requiredStamps: 10,
  currentStamps: 0,
  rewardType: "discount_percent",
  rewardValue: 20,
  rewardDescription: "20% de descuento al completar la tarjeta",
  status: "active",
  expiresOn: "",
};

const leadTone: Record<LeadStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  new: "info",
  contacted: "warning",
  qualified: "success",
  converted: "success",
  discarded: "neutral",
};

const campaignTone: Record<CampaignStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  draft: "neutral",
  active: "success",
  paused: "warning",
  closed: "info",
};

const MARKETING_MODULE_RELEASED = false;

export function MarketingRealPage({ session }: MarketingRealPageProps) {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [leads, setLeads] = useState<MarketingLead[]>([]);
  const [loyaltyCards, setLoyaltyCards] = useState<MarketingLoyaltyCard[]>([]);
  const [leadSummary, setLeadSummary] = useState<Record<string, number>>({});
  const [loyaltySummary, setLoyaltySummary] = useState<Record<string, number>>({});
  const [campaignForm, setCampaignForm] = useState<CampaignInput>(initialCampaign);
  const [leadForm, setLeadForm] = useState<LeadInput>(initialLead);
  const [loyaltyForm, setLoyaltyForm] = useState<LoyaltyCardInput>(initialLoyaltyCard);
  const [editingLoyaltyCardId, setEditingLoyaltyCardId] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<"campaign" | "lead" | "loyalty" | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const totals = useMemo(() => {
    return {
      campaigns: campaigns.length,
      leads: leadSummary.total || leads.length,
      qualified: leadSummary.qualified || 0,
      converted: leadSummary.converted || 0,
      loyaltyCards: loyaltySummary.total || loyaltyCards.length,
    };
  }, [campaigns.length, leadSummary, leads.length, loyaltyCards.length, loyaltySummary]);

  useEffect(() => {
    if (!MARKETING_MODULE_RELEASED) {
      setLoading(false);
      return;
    }
    void refresh();
  }, []);

  if (!MARKETING_MODULE_RELEASED) {
    return (
      <section className="production-module-content">
        <PageHeader
          eyebrow="Marketing"
          title="Marketing y fidelizacion"
          description="Modulo reservado para campanas, leads y tarjetas de fidelizacion."
        />
        <div className="coming-soon marketing-coming-soon">
          <div className="empty-state">
            <span className="empty-icon">
              <Megaphone size={28} />
            </span>
            <h2>Proximamente</h2>
            <p>Estamos trabajando en el desarrollo de este modulo. Por ahora no esta disponible para clientes finales.</p>
            <StatusBadge label="Modulo bloqueado" tone="warning" />
          </div>
        </div>
      </section>
    );
  }

  async function refresh(options: { preserveMessage?: boolean } = {}) {
    setLoading(true);
    if (!options.preserveMessage) {
      setMessage(null);
    }
    try {
      const [campaignResult, leadResult, loyaltyResult] = await Promise.all([
        listMarketingCampaigns(session.sessionToken),
        listMarketingLeads(session.sessionToken),
        listMarketingLoyaltyCards(session.sessionToken),
      ]);
      setCampaigns(campaignResult);
      setLeads(leadResult.items);
      setLeadSummary(leadResult.summary || {});
      setLoyaltyCards(loyaltyResult.items);
      setLoyaltySummary(loyaltyResult.summary || {});
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar marketing.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingId("campaign");
    setMessage(null);
    try {
      await createMarketingCampaign(session.sessionToken, { ...campaignForm, budgetAmount: Number(campaignForm.budgetAmount) });
      setCampaignForm(initialCampaign);
      setActivePanel(null);
      setMessage("Campana creada con auditoria.");
      dispatchDataChanged("marketing");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear campana.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleCreateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingId("lead");
    setMessage(null);
    try {
      await createMarketingLead(session.sessionToken, { ...leadForm, campaignId: leadForm.campaignId || undefined });
      setLeadForm(initialLead);
      setActivePanel(null);
      setMessage("Lead creado. Recuerda convertir solo si hay consentimiento aceptado.");
      dispatchDataChanged("marketing");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear lead.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleConvertLead(lead: MarketingLead) {
    setSavingId(lead.leadId);
    setMessage(null);
    try {
      await convertMarketingLead(session.sessionToken, lead.leadId);
      setMessage("Lead convertido a cliente CRM.");
      dispatchDataChanged("crm");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo convertir el lead.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleCreateLoyaltyCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingId("loyalty");
    setMessage(null);
    try {
      const payload = {
        ...loyaltyForm,
        requiredStamps: Number(loyaltyForm.requiredStamps),
        currentStamps: Number(loyaltyForm.currentStamps || 0),
        rewardValue: loyaltyForm.rewardValue === null || loyaltyForm.rewardValue === undefined ? null : Number(loyaltyForm.rewardValue),
        expiresOn: loyaltyForm.expiresOn || undefined,
      };
      if (editingLoyaltyCardId) {
        await updateMarketingLoyaltyCard(session.sessionToken, editingLoyaltyCardId, payload);
      } else {
        await createMarketingLoyaltyCard(session.sessionToken, payload);
      }
      setLoyaltyForm(initialLoyaltyCard);
      setEditingLoyaltyCardId(null);
      setActivePanel(null);
      setMessage(editingLoyaltyCardId ? "Tarjeta de fidelizacion actualizada." : "Tarjeta de fidelizacion creada con codigo automatico.");
      dispatchDataChanged("marketing");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear la tarjeta de fidelizacion.");
    } finally {
      setSavingId(null);
    }
  }

  async function quickUpdateLoyaltyCard(card: MarketingLoyaltyCard, input: Partial<LoyaltyCardInput>, successMessage: string) {
    setSavingId(card.loyaltyCardId);
    setMessage(null);
    try {
      await updateMarketingLoyaltyCard(session.sessionToken, card.loyaltyCardId, input);
      setMessage(successMessage);
      dispatchDataChanged("marketing");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar la tarjeta.");
    } finally {
      setSavingId(null);
    }
  }

  function startEditLoyaltyCard(card: MarketingLoyaltyCard) {
    setEditingLoyaltyCardId(card.loyaltyCardId);
    setLoyaltyForm({
      title: card.title,
      customerName: card.customerName,
      customerPhone: card.customerPhone,
      requiredStamps: card.requiredStamps,
      currentStamps: card.currentStamps,
      rewardType: card.rewardType,
      rewardValue: card.rewardValue,
      rewardDescription: card.rewardDescription,
      status: card.status,
      expiresOn: card.expiresOn,
    });
    setActivePanel("loyalty");
  }

  return (
    <section className="production-module-content">
      <PageHeader
        eyebrow="Marketing F11"
        title="Marketing y leads"
        description="Campanas internas, leads con consentimiento y conversion segura a CRM. Sin APIs externas ni envios masivos."
        actions={
          <div className="segmented-actions">
            <Button variant="primary" type="button" icon={<Plus size={16} />} onClick={() => setActivePanel(activePanel === "lead" ? null : "lead")}>
              Crear lead
            </Button>
            <Button variant="secondary" type="button" icon={<Stamp size={16} />} onClick={() => setActivePanel(activePanel === "loyalty" ? null : "loyalty")}>
              Crear tarjeta
            </Button>
            <Button variant="secondary" type="button" icon={<Plus size={16} />} onClick={() => setActivePanel(activePanel === "campaign" ? null : "campaign")}>
              Crear campana
            </Button>
            <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>
              Actualizar
            </Button>
          </div>
        }
      />

      {message ? <p className="login-notice">{message}</p> : null}

      <section className="grid stats-grid crm-real-stats">
        <SummaryCard label="Campanas" value={loading && campaigns.length === 0 ? "Cargando" : totals.campaigns} icon={<Megaphone size={20} />} />
        <SummaryCard label="Leads" value={loading && leads.length === 0 ? "Cargando" : totals.leads} icon={<Users size={20} />} />
        <SummaryCard label="Calificados" value={loading && leads.length === 0 ? "Cargando" : totals.qualified} icon={<MousePointerClick size={20} />} />
        <SummaryCard label="Convertidos" value={loading && leads.length === 0 ? "Cargando" : totals.converted} icon={<CheckCircle2 size={20} />} />
        <SummaryCard label="Tarjetas" value={loading && loyaltyCards.length === 0 ? "Cargando" : totals.loyaltyCards} icon={<Stamp size={20} />} />
      </section>

      <BasicModal title="Nueva campana" open={activePanel === "campaign"} onClose={() => setActivePanel(null)} size="wide" footer={null}>
        <form className="auth-form" onSubmit={handleCreateCampaign}>
          <div className="card-title-row">
            <span className="activity-meta">Campana interna para clasificar leads. Sin envios masivos externos.</span>
            <StatusBadge label="Interna" tone="info" />
          </div>
          <div className="grid proof-grid">
            <label className="form-control">
              <span>Nombre</span>
              <input className="input" value={campaignForm.name} onChange={(event) => setCampaignForm({ ...campaignForm, name: event.target.value })} required />
            </label>
            <label className="form-control">
              <span>Canal</span>
              <input className="input" value={campaignForm.channel} onChange={(event) => setCampaignForm({ ...campaignForm, channel: event.target.value })} required />
            </label>
            <label className="form-control">
              <span>Estado</span>
              <select className="select" value={campaignForm.status} onChange={(event) => setCampaignForm({ ...campaignForm, status: event.target.value as CampaignStatus })}>
                <option value="draft">Borrador</option>
                <option value="active">Activa</option>
                <option value="paused">Pausada</option>
                <option value="closed">Cerrada</option>
              </select>
            </label>
            <label className="form-control">
              <span>Presupuesto interno</span>
              <input className="input" type="number" min="0" step="0.01" value={campaignForm.budgetAmount || ""} onChange={(event) => setCampaignForm({ ...campaignForm, budgetAmount: Number(event.target.value) })} />
            </label>
          </div>
          <Button variant="primary" type="submit" icon={<Save size={16} />} disabled={savingId === "campaign"}>
            Guardar campana
          </Button>
        </form>
      </BasicModal>

      <BasicModal title="Nuevo lead" open={activePanel === "lead"} onClose={() => setActivePanel(null)} size="wide" footer={null}>
        <form className="auth-form" onSubmit={handleCreateLead}>
          <div className="card-title-row">
            <span className="activity-meta">El consentimiento define si puede convertirse o contactarse comercialmente.</span>
            <StatusBadge label="Consentimiento primero" tone="warning" />
          </div>
          <div className="grid proof-grid">
            <label className="form-control">
              <span>Campana opcional</span>
              <select className="select" value={leadForm.campaignId || ""} onChange={(event) => setLeadForm({ ...leadForm, campaignId: event.target.value })}>
                <option value="">Sin campana</option>
                {campaigns.map((campaign) => (
                  <option value={campaign.campaignId} key={campaign.campaignId}>{campaign.name}</option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span>Nombre</span>
              <input className="input" value={leadForm.name} onChange={(event) => setLeadForm({ ...leadForm, name: event.target.value })} required />
            </label>
            <label className="form-control">
              <span>Fuente</span>
              <input className="input" value={leadForm.source} onChange={(event) => setLeadForm({ ...leadForm, source: event.target.value })} required />
            </label>
            <label className="form-control">
              <span>Servicio de interes</span>
              <input className="input" value={leadForm.serviceInterest || ""} onChange={(event) => setLeadForm({ ...leadForm, serviceInterest: event.target.value })} />
            </label>
            <label className="form-control">
              <span>Estado</span>
              <select className="select" value={leadForm.status} onChange={(event) => setLeadForm({ ...leadForm, status: event.target.value as LeadStatus })}>
                <option value="new">Nuevo</option>
                <option value="contacted">Contactado</option>
                <option value="qualified">Calificado</option>
                <option value="discarded">Descartado</option>
              </select>
            </label>
            <label className="form-control">
              <span>Consentimiento</span>
              <select className="select" value={leadForm.consentStatus} onChange={(event) => setLeadForm({ ...leadForm, consentStatus: event.target.value as ConsentStatus })}>
                <option value="pending">Pendiente</option>
                <option value="accepted">Aceptado</option>
                <option value="rejected">Rechazado</option>
              </select>
            </label>
            <label className="form-control">
              <span>Correo</span>
              <input className="input" type="email" value={leadForm.email || ""} onChange={(event) => setLeadForm({ ...leadForm, email: event.target.value })} />
            </label>
            <label className="form-control">
              <span>Telefono</span>
              <input className="input" value={leadForm.phone || ""} onChange={(event) => setLeadForm({ ...leadForm, phone: event.target.value })} />
            </label>
          </div>
          <label className="form-control">
            <span>Notas</span>
            <textarea className="input crm-textarea" value={leadForm.notes || ""} onChange={(event) => setLeadForm({ ...leadForm, notes: event.target.value })} />
          </label>
          <Button variant="primary" type="submit" icon={<Save size={16} />} disabled={savingId === "lead"}>
            Guardar lead
          </Button>
        </form>
      </BasicModal>

      <BasicModal title={editingLoyaltyCardId ? "Editar tarjeta de fidelizacion" : "Nueva tarjeta de fidelizacion"} open={activePanel === "loyalty"} onClose={() => setActivePanel(null)} size="wide" footer={null}>
        <form className="auth-form" onSubmit={handleCreateLoyaltyCard}>
          <div className="card-title-row">
            <span className="activity-meta">El codigo y QR se generan por el sistema. No se guarda diseno grafico pesado.</span>
            <StatusBadge label={editingLoyaltyCardId ? "Editable" : "Codigo automatico"} tone="success" />
          </div>
          <div className="grid proof-grid">
            <label className="form-control">
              <span>Titulo</span>
              <input className="input" value={loyaltyForm.title} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, title: event.target.value })} required />
            </label>
            <label className="form-control">
              <span>Cliente opcional</span>
              <input className="input" value={loyaltyForm.customerName || ""} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, customerName: event.target.value })} />
            </label>
            <label className="form-control">
              <span>Telefono opcional</span>
              <input className="input" value={loyaltyForm.customerPhone || ""} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, customerPhone: event.target.value })} />
            </label>
            <label className="form-control">
              <span>Sellos necesarios</span>
              <input className="input" type="number" min="1" max="100" step="1" value={loyaltyForm.requiredStamps || ""} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, requiredStamps: Number(event.target.value) })} required />
            </label>
            <label className="form-control">
              <span>Sellos iniciales</span>
              <input className="input" type="number" min="0" max={loyaltyForm.requiredStamps || 100} step="1" value={loyaltyForm.currentStamps || ""} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, currentStamps: Number(event.target.value) })} />
            </label>
            <label className="form-control">
              <span>Tipo de recompensa</span>
              <select className="select" value={loyaltyForm.rewardType} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, rewardType: event.target.value as LoyaltyRewardType })}>
                <option value="discount_percent">Descuento porcentual</option>
                <option value="discount_amount">Descuento fijo</option>
                <option value="gift">Regalo</option>
                <option value="custom">Personalizada</option>
              </select>
            </label>
            <label className="form-control">
              <span>Valor de recompensa</span>
              <input className="input" type="number" min="0" step="0.01" value={loyaltyForm.rewardValue ?? ""} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, rewardValue: event.target.value === "" ? null : Number(event.target.value) })} />
            </label>
            <label className="form-control">
              <span>Vence el</span>
              <input className="input" type="date" value={loyaltyForm.expiresOn || ""} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, expiresOn: event.target.value })} />
            </label>
          </div>
          <label className="form-control">
            <span>Recompensa final</span>
            <input className="input" value={loyaltyForm.rewardDescription} onChange={(event) => setLoyaltyForm({ ...loyaltyForm, rewardDescription: event.target.value })} required />
          </label>
          <Button variant="primary" type="submit" icon={<Save size={16} />} disabled={savingId === "loyalty"}>
            {editingLoyaltyCardId ? "Guardar cambios" : "Generar tarjeta"}
          </Button>
        </form>
      </BasicModal>

      <section className="grid two-column crm-real-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Campanas</h2>
            <StatusBadge label={loading ? "Cargando" : `${campaigns.length} registros`} tone="info" />
          </div>
          {!loading && campaigns.length === 0 ? (
            <EmptyState title="Sin campanas" description="Crea campanas internas para agrupar leads por fuente." />
          ) : (
            <div className="responsive-table">
              <div className="table-header marketing-campaign-grid">
                <span>Campana</span>
                <span>Canal</span>
                <span>Leads</span>
                <span>Conversiones</span>
              </div>
              {campaigns.map((campaign) => (
                <article className="table-row marketing-campaign-grid" key={campaign.campaignId}>
                  <div>
                    <strong>{campaign.name}</strong>
                    <p className="activity-meta">{formatMoney(campaign.budgetAmount)} presupuesto</p>
                  </div>
                  <span>{campaign.channel}</span>
                  <strong>{campaign.leadsCount}</strong>
                  <StatusBadge label={campaign.status} tone={campaignTone[campaign.status]} />
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Leads</h2>
            <StatusBadge label="Consentimiento obligatorio" tone="warning" />
          </div>
          {!loading && leads.length === 0 ? (
            <EmptyState title="Sin leads" description="Registra interesados reales y conviertelos a CRM cuando acepten tratamiento de datos." />
          ) : (
            <div className="responsive-table">
              <div className="table-header marketing-leads-grid">
                <span>Lead</span>
                <span>Fuente</span>
                <span>Servicio</span>
                <span>Estado</span>
                <span>Accion</span>
              </div>
              {leads.map((lead) => (
                <article className="table-row marketing-leads-grid" key={lead.leadId}>
                  <div>
                    <strong>{lead.name}</strong>
                    <p className="activity-meta">{lead.email || lead.phone || "sin contacto"}</p>
                  </div>
                  <span>{lead.source}</span>
                  <span>{lead.serviceInterest || "General"}</span>
                  <div className="stacked-badges">
                    <StatusBadge label={lead.status} tone={leadTone[lead.status]} />
                    <StatusBadge label={lead.consentStatus} tone={lead.consentStatus === "accepted" ? "success" : lead.consentStatus === "rejected" ? "danger" : "warning"} />
                  </div>
                  <Button variant="secondary" type="button" icon={<CheckCircle2 size={15} />} onClick={() => void handleConvertLead(lead)} disabled={savingId === lead.leadId || lead.status === "converted" || lead.consentStatus !== "accepted"}>
                    Convertir
                  </Button>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-title-row">
          <h2 className="card-title">Tarjetas de fidelizacion</h2>
          <StatusBadge label={loading ? "Cargando" : `${loyaltyCards.length} tarjetas`} tone="info" />
        </div>
        {!loading && loyaltyCards.length === 0 ? (
          <EmptyState title="Sin tarjetas de fidelizacion" description="Genera tarjetas con codigo automatico, sellos configurables y recompensa final." />
        ) : (
          <div className="responsive-table">
            <div className="table-header marketing-leads-grid">
              <span>Tarjeta</span>
              <span>Cliente</span>
              <span>Sellos</span>
              <span>Recompensa</span>
              <span>Estado</span>
            </div>
            {loyaltyCards.map((card) => (
              <article className="table-row marketing-leads-grid" key={card.loyaltyCardId}>
                <div>
                  <strong>{card.cardCode}</strong>
                  <p className="activity-meta">{card.title}</p>
                  <div style={{ marginTop: 8 }}>
                    <QrCodeSvg value={`CFLOY:${card.cardCode}`} size={82} title={`QR ${card.cardCode}`} />
                  </div>
                </div>
                <span>{card.customerName || "Sin cliente asignado"}</span>
                <div>
                  <strong>{card.currentStamps}/{card.requiredStamps}</strong>
                  <p className="activity-meta">{card.expiresOn ? `vence ${card.expiresOn}` : "sin vencimiento"}</p>
                  <div className="stacked-badges" style={{ marginTop: 8 }}>
                    <Button variant="secondary" type="button" onClick={() => void quickUpdateLoyaltyCard(card, { currentStamps: Math.max(0, card.currentStamps - 1) }, "Sello descontado.")} disabled={savingId === card.loyaltyCardId || card.currentStamps <= 0}>
                      - sello
                    </Button>
                    <Button variant="secondary" type="button" onClick={() => void quickUpdateLoyaltyCard(card, { currentStamps: Math.min(card.requiredStamps, card.currentStamps + 1) }, "Sello agregado.")} disabled={savingId === card.loyaltyCardId || card.currentStamps >= card.requiredStamps}>
                      + sello
                    </Button>
                  </div>
                </div>
                <div>
                  <strong>{card.rewardDescription}</strong>
                  <p className="activity-meta">{rewardTypeLabel(card.rewardType)} {card.rewardValue ?? ""}</p>
                  <div className="stacked-badges" style={{ marginTop: 8 }}>
                    <Button variant="secondary" type="button" onClick={() => startEditLoyaltyCard(card)} disabled={savingId === card.loyaltyCardId}>
                      Editar
                    </Button>
                    <Button variant="secondary" type="button" onClick={() => void quickUpdateLoyaltyCard(card, { status: "redeemed" }, "Tarjeta marcada como canjeada.")} disabled={savingId === card.loyaltyCardId || card.status === "redeemed"}>
                      Canjear
                    </Button>
                  </div>
                </div>
                <StatusBadge label={card.status} tone={card.status === "active" ? "success" : card.status === "redeemed" ? "info" : "warning"} />
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
        </div>
        <span className="stat-icon info">{icon}</span>
      </div>
      <span className="stat-note">Datos reales del tenant</span>
    </article>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "USD" }).format(value || 0);
}

function rewardTypeLabel(value: string) {
  return {
    discount_percent: "Descuento %",
    discount_amount: "Descuento fijo",
    gift: "Regalo",
    custom: "Personalizada",
  }[value] || value;
}

function dispatchDataChanged(module: string) {
  window.dispatchEvent(new CustomEvent("constriqo:data-changed", { detail: { module } }));
}
