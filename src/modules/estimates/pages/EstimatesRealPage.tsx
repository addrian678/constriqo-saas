import { Calculator, CheckCircle2, Download, FileText, Mail, Plus, Printer, RefreshCw, Save, XCircle } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { openBlobInDocumentViewer, type AuthenticatedSession } from "../../../app/auth/authClient";
import { saveDocumentToCurrentDevice } from "../../../app/native/nativeCapabilities";
import { BasicModal } from "../../../shared/components/BasicModal";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { listCrmClients, type CrmClient } from "../../crm/api/crmClient";
import { getTenantSettings, type TenantSettings } from "../../organization/api/organizationClient";
import { listServices, type ServiceCatalogItem, type UnitCode } from "../../services/api/serviceCatalogClient";
import {
  approveEstimate,
  createEstimate,
  downloadEstimatePdf,
  getEstimate,
  listEstimates,
  sendEstimateEmail,
  updateEstimateStatus,
  type EstimateDetailResponse,
  type EstimateInput,
  type EstimateSummary,
} from "../api/estimateClient";
import { createInvoice } from "../../invoicing/api/invoiceClient";

type EstimatesRealPageProps = {
  session: AuthenticatedSession;
};

type EstimateAction = "approve" | "review" | "reject" | "cancel" | "invoice";

const estimateActionCopy: Record<EstimateAction, { title: string; description: string; confirmLabel: string }> = {
  approve: {
    title: "Aprobar cotizacion",
    description: "La cotizacion quedara aprobada y podra convertirse en factura. Esta accion queda registrada en auditoria.",
    confirmLabel: "Si, aprobar cotizacion",
  },
  review: {
    title: "Marcar en revision",
    description: "Usa este estado cuando la cotizacion necesita ajustes antes de enviarse o aprobarse.",
    confirmLabel: "Si, marcar en revision",
  },
  reject: {
    title: "Rechazar cotizacion",
    description: "Usa esta opcion cuando el cliente no acepto la cotizacion. No se borra: queda visible en historial.",
    confirmLabel: "Si, rechazar cotizacion",
  },
  cancel: {
    title: "Cancelar cotizacion",
    description: "Usa esta opcion para anularla por error interno, duplicado o cambio de alcance. No se borra: queda visible en historial.",
    confirmLabel: "Si, cancelar cotizacion",
  },
  invoice: {
    title: "Generar factura",
    description: "Se creara una factura en borrador ligada a esta cotizacion aprobada. Despues podras emitirla y cobrarla desde Facturas.",
    confirmLabel: "Si, generar factura",
  },
};

function createInitialForm(settings?: TenantSettings | null): EstimateInput {
  const unitSystem = settings?.unitSystem || "imperial";
  return {
    clientId: "",
    title: "",
    scope: "",
    conditions: "",
    exclusions: "",
    currency: settings?.currency || "USD",
    countryProfile: settings?.countryProfile || "US",
    unitSystem,
    documentLanguage: settings?.documentLanguage || "es",
    templateId: settings?.estimateTemplateId || "estimate_classic_blue",
    taxRate: 0,
    project: { name: "", address: "", latitude: null, longitude: null, overview: "" },
    costBreakdown: createEmptyCostBreakdown(),
    sections: [
      {
        title: "General",
        items: [{ serviceCatalogItemId: null, description: "", quantity: 1, unitCode: unitSystem === "metric" ? "m2" : "sq_ft", unitSystem, unitPrice: 0 }],
      },
    ],
  };
}

type CostBreakdownLineKey = Exclude<keyof NonNullable<EstimateInput["costBreakdown"]>, "enabled" | "manualTotal" | "taxAmount">;

const costBreakdownFields: Array<{ key: CostBreakdownLineKey; label: string }> = [
  { key: "materialsSubtotal", label: "Subtotal de materiales" },
  { key: "laborSubtotal", label: "Subtotal de mano de obra" },
  { key: "equipmentSubtotal", label: "Subtotal de equipos" },
  { key: "subcontractorsSubtotal", label: "Subtotal de subcontratistas" },
  { key: "permitsFees", label: "Permisos y tasas" },
  { key: "transport", label: "Transporte" },
  { key: "wasteManagement", label: "Gestion de residuos" },
  { key: "overhead", label: "Gastos generales" },
  { key: "contingency", label: "Contingencia" },
  { key: "profit", label: "Beneficio" },
  { key: "discounts", label: "Descuentos" },
];

function createEmptyCostBreakdown(): NonNullable<EstimateInput["costBreakdown"]> {
  const field = (amount = 0) => ({ applies: true, mode: "manual" as const, amount });
  return {
    enabled: false,
    materialsSubtotal: field(),
    laborSubtotal: field(),
    equipmentSubtotal: field(),
    subcontractorsSubtotal: field(),
    permitsFees: field(),
    transport: field(),
    wasteManagement: field(),
    overhead: field(),
    contingency: field(),
    profit: field(),
    discounts: field(),
    taxAmount: field(),
    manualTotal: { enabled: false, applies: true, mode: "manual", amount: 0 },
  };
}

const metricUnits: UnitCode[] = ["m2", "linear_m", "m", "cm", "unit", "hour", "day"];
const imperialUnits: UnitCode[] = ["sq_ft", "linear_ft", "ft", "in", "unit", "hour", "day"];

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  review: "En revision",
  approved: "Aprobada",
  rejected: "Rechazada",
  archived: "Archivada",
  cancelled: "Cancelada",
};

export function EstimatesRealPage({ session }: EstimatesRealPageProps) {
  const [estimates, setEstimates] = useState<EstimateSummary[]>([]);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EstimateDetailResponse | null>(null);
  const [form, setForm] = useState<EstimateInput>(createInitialForm());
  const [summary, setSummary] = useState({ total: 0, draft: 0, sent: 0, approved: 0, cancelled: 0, totalAmount: 0 });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<EstimateAction | null>(null);

  const formSubtotal = useMemo(() => {
    if (form.costBreakdown?.manualTotal.enabled) {
      return Math.max(0, Number(form.costBreakdown.manualTotal.amount || 0) - Number(form.costBreakdown.taxAmount.amount || 0));
    }
    if (form.costBreakdown?.enabled) {
      const additions = costBreakdownFields
        .filter((field) => field.key !== "discounts")
        .reduce((total, field) => total + (form.costBreakdown?.[field.key].applies === false ? 0 : Number(form.costBreakdown?.[field.key].amount || 0)), 0);
      const discounts = form.costBreakdown.discounts.applies === false ? 0 : Number(form.costBreakdown.discounts.amount || 0);
      return Math.max(0, additions - discounts);
    }
    return form.sections.reduce((sectionTotal, section) => {
      return sectionTotal + section.items.reduce((total, item) => total + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
    }, 0);
  }, [form.costBreakdown, form.sections]);
  const formTax = form.costBreakdown?.taxAmount.mode === "manual" && form.costBreakdown.enabled
    ? Number(form.costBreakdown.taxAmount.amount || 0)
    : formSubtotal * (Number(form.taxRate || 0) / 100);
  const formTotal = form.costBreakdown?.manualTotal.enabled ? Number(form.costBreakdown.manualTotal.amount || 0) : formSubtotal + formTax;

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(nextSelectedId?: string | null, options: { preserveMessage?: boolean } = {}) {
    setLoading(true);
    if (!options.preserveMessage) {
      setMessage(null);
    }
    try {
      const [estimateResult, clientResult, settingsResult, serviceResult] = await Promise.all([
        listEstimates(session.sessionToken),
        listCrmClients(session.sessionToken),
        getTenantSettings(session.sessionToken),
        listServices(session.sessionToken),
      ]);
      setEstimates(estimateResult.items);
      setSummary({ ...estimateResult.summary, cancelled: estimateResult.summary.cancelled || 0 });
      setClients(clientResult.items);
      setSettings(settingsResult);
      setServices(serviceResult);
      setForm((current) => (current.clientId || current.title ? current : createInitialForm(settingsResult)));
      if (nextSelectedId !== undefined) {
        setSelectedEstimateId(nextSelectedId);
        if (nextSelectedId) {
          await loadDetail(nextSelectedId);
        } else {
          setDetail(null);
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar cotizaciones.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(estimateId: string) {
    try {
      if (selectedEstimateId === estimateId && detail) {
        setSelectedEstimateId(null);
        setDetail(null);
        setMessage(null);
        return;
      }
      setSelectedEstimateId(estimateId);
      setDetail(await getEstimate(session.sessionToken, estimateId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el detalle.");
    }
  }

  function updateItem(field: "serviceCatalogItemId" | "description" | "quantity" | "unitPrice" | "unitCode", value: string, index: number) {
    const nextSections = form.sections.map((section, sectionIndex) => {
      if (sectionIndex !== 0) {
        return section;
      }
      return {
        ...section,
        items: section.items.map((item, itemIndex) => {
          if (itemIndex !== index) {
            return item;
          }
          return {
            ...item,
            [field]: field === "description" || field === "serviceCatalogItemId" || field === "unitCode" ? value : Number(value),
          };
        }),
      };
    });
    setForm({ ...form, sections: nextSections });
  }

  function addItem() {
    const unitSystem = form.unitSystem || settings?.unitSystem || "imperial";
    setForm({
      ...form,
      sections: [
        {
          ...form.sections[0],
          items: [...form.sections[0].items, { serviceCatalogItemId: null, description: "", quantity: 1, unitCode: unitSystem === "metric" ? "m2" : "sq_ft", unitSystem, unitPrice: 0 }],
        },
      ],
    });
  }

  function updateCostField(
    key: CostBreakdownLineKey | "manualTotal" | "enabled",
    patch: Partial<{ applies: boolean; amount: number; enabled: boolean }>,
  ) {
    const current = form.costBreakdown || createEmptyCostBreakdown();
    if (key === "enabled") {
      setForm({ ...form, costBreakdown: { ...current, enabled: Boolean(patch.enabled) } });
      return;
    }
    setForm({
      ...form,
      costBreakdown: {
        ...current,
        [key]: {
          ...current[key],
          ...patch,
        },
      },
    });
  }

  function applyService(serviceId: string, index: number) {
    const service = services.find((item) => item.serviceId === serviceId);
    if (!service) {
      updateItem("serviceCatalogItemId", "", index);
      return;
    }
    const nextSections = form.sections.map((section, sectionIndex) => {
      if (sectionIndex !== 0) {
        return section;
      }
      return {
        ...section,
        items: section.items.map((item, itemIndex) => {
          if (itemIndex !== index) {
            return item;
          }
          return {
            ...item,
            serviceCatalogItemId: service.serviceId,
            description: service.name,
            unitCode: service.unitCode,
            unitSystem: service.unitSystem,
            unitPrice: service.unitPrice,
          };
        }),
      };
    });
    setForm({
      ...form,
      currency: service.currency,
      countryProfile: service.countryProfile,
      unitSystem: service.unitSystem,
      taxRate: service.defaultTaxRate,
      sections: nextSections,
    });
  }

  async function handleCreateEstimate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const created = await createEstimate(session.sessionToken, form);
      setForm(createInitialForm(settings));
      setShowCreateForm(false);
      setMessage("Cotizacion creada con version 1 y auditoria.");
      dispatchDataChanged("estimates");
      await refresh(created.estimateId, { preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear la cotizacion.");
    } finally {
      setSaving(false);
    }
  }

  function requestEstimateAction(action: EstimateAction) {
    if (!detail) {
      return;
    }
    if (action === "invoice" && detail.estimate.status !== "approved") {
      setMessage("Primero aprueba la cotizacion antes de convertirla en factura.");
      return;
    }
    setMessage(null);
    setPendingAction(action);
  }

  async function executeEstimateAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingAction) {
      return;
    }
    if (pendingAction === "approve") {
      await handleApprove();
    } else if (pendingAction === "review") {
      await handleReviewEstimate();
    } else if (pendingAction === "reject") {
      await handleRejectEstimate();
    } else if (pendingAction === "cancel") {
      await handleCancelEstimate();
    } else {
      await handleCreateInvoiceFromEstimate();
    }
    setPendingAction(null);
  }

  async function handleApprove() {
    if (!selectedEstimateId) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await approveEstimate(session.sessionToken, selectedEstimateId, "Aprobada desde modulo real.");
      await refresh(selectedEstimateId);
      dispatchDataChanged("estimates");
      setMessage("Cotizacion aprobada y auditada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo aprobar la cotizacion.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!selectedEstimateId) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateEstimateStatus(session.sessionToken, selectedEstimateId, "sent");
      await refresh(selectedEstimateId);
      dispatchDataChanged("estimates");
      setMessage("Cotizacion marcada como enviada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el estado.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReviewEstimate() {
    if (!selectedEstimateId) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateEstimateStatus(session.sessionToken, selectedEstimateId, "review");
      await refresh(selectedEstimateId);
      dispatchDataChanged("estimates");
      setMessage("Cotizacion marcada en revision.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo marcar en revision.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRejectEstimate() {
    if (!selectedEstimateId) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateEstimateStatus(session.sessionToken, selectedEstimateId, "rejected");
      await refresh(selectedEstimateId);
      dispatchDataChanged("estimates");
      setMessage("Cotizacion rechazada y conservada en historial.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo rechazar la cotizacion.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelEstimate() {
    if (!selectedEstimateId) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateEstimateStatus(session.sessionToken, selectedEstimateId, "cancelled");
      await refresh(selectedEstimateId);
      dispatchDataChanged("estimates");
      setMessage("Cotizacion cancelada. Permanece visible en historial y auditoria.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cancelar la cotizacion.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    if (!selectedEstimateId || !detail) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const blob = await downloadEstimatePdf(session.sessionToken, selectedEstimateId);
      saveDocumentToCurrentDevice(blob, `${detail.estimate.estimateNumber}.pdf`);
      setMessage("PDF de cotizacion generado con la plantilla activa.");
      dispatchDataChanged("documents");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo descargar el PDF.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePrepareEmail() {
    if (!selectedEstimateId) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const delivery = await sendEstimateEmail(session.sessionToken, selectedEstimateId);
      setMessage(`Correo preparado en sandbox para ${delivery.recipientEmail}. No se envio fuera del sistema.`);
      dispatchDataChanged("estimates");
      await refresh(selectedEstimateId, { preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo preparar el correo de cotizacion.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePrint() {
    if (!selectedEstimateId || !detail) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const blob = await downloadEstimatePdf(session.sessionToken, selectedEstimateId);
      const opened = openBlobInDocumentViewer(blob, `${detail.estimate.estimateNumber}.pdf`);
      setMessage(opened ? "PDF real abierto para imprimir desde el visor del dispositivo." : "PDF descargado porque el navegador bloqueo la ventana de impresion.");
      dispatchDataChanged("documents");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo preparar el PDF para imprimir.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateInvoiceFromEstimate() {
    if (!detail) {
      return;
    }
    if (detail.estimate.status !== "approved") {
      setMessage("Primero aprueba la cotizacion antes de convertirla en factura.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const invoice = await createInvoice(session.sessionToken, {
        estimateId: detail.estimate.estimateId,
        title: detail.estimate.title,
      });
      setMessage(`Factura ${invoice.invoiceNumber} creada en borrador. Puedes emitirla y cobrarla desde Facturas.`);
      dispatchDataChanged("invoicing");
      await refresh(detail.estimate.estimateId, { preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo convertir la cotizacion en factura.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="production-module-content">
      <PageHeader
        eyebrow="Cotizaciones reales"
        title="Presupuestos"
        description="Alta de cotizaciones con clientes reales, catalogo de servicios, moneda, unidades, impuestos, snapshot de precios y aprobacion auditada."
        actions={
          <div className="segmented-actions">
            <Button variant="primary" type="button" icon={<Plus size={16} />} onClick={() => setShowCreateForm((value) => !value)}>
              Crear cotizacion
            </Button>
            <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>
              Actualizar
            </Button>
          </div>
        }
      />

      {message ? <p className="login-notice">{message}</p> : null}

      <section className="grid stats-grid crm-real-stats">
        <SummaryCard icon={<FileText size={20} />} label="Cotizaciones" value={loading && estimates.length === 0 ? "Cargando" : summary.total} />
        <SummaryCard icon={<Plus size={20} />} label="Borradores" value={loading && estimates.length === 0 ? "Cargando" : summary.draft} />
        <SummaryCard icon={<CheckCircle2 size={20} />} label="Aprobadas" value={loading && estimates.length === 0 ? "Cargando" : summary.approved} />
        <SummaryCard icon={<XCircle size={20} />} label="Canceladas" value={loading && estimates.length === 0 ? "Cargando" : summary.cancelled || 0} />
        <SummaryCard icon={<Calculator size={20} />} label="Importe total" value={loading && estimates.length === 0 ? "Cargando" : formatMoney(summary.totalAmount, settings?.currency || "USD")} />
      </section>

      <section className="grid crm-real-grid">
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Listado</h2>
            <StatusBadge label={loading ? "Cargando" : `${estimates.length} registros`} tone="info" />
          </div>

          {!loading && estimates.length === 0 ? (
            <EmptyState
              title="Sin cotizaciones todavia"
              description="Crea la primera cotizacion seleccionando un cliente real. No se cargan datos de ejemplo."
            />
          ) : (
            <div className="crm-client-list">
              {estimates.map((estimate) => (
                <article className="activity-item crm-client-row" key={estimate.estimateId}>
                  <span className="activity-icon">
                    <FileText size={18} />
                  </span>
                  <button className="crm-client-button" type="button" onClick={() => void loadDetail(estimate.estimateId)}>
                    <strong>{estimate.estimateNumber} - {estimate.title}</strong>
                    <span>{estimate.clientName || "Cliente sin nombre"} · {formatMoney(estimate.totalAmount, estimate.currency)}</span>
                  </button>
                  <div className="crm-client-actions">
                    <StatusBadge label={statusLabels[estimate.status] || estimate.status} tone={estimate.status === "approved" ? "success" : "neutral"} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <BasicModal title="Nueva cotizacion" open={showCreateForm} onClose={() => setShowCreateForm(false)} size="wide" footer={null}>
          <div className="card-title-row">
            <h2 className="card-title">Datos de cotizacion</h2>
            <StatusBadge label={formatMoney(formTotal, form.currency || "EUR")} tone="success" />
          </div>

          {clients.length === 0 ? (
            <p className="login-security-note">Primero crea un cliente en CRM. Las cotizaciones no aceptan clientes inexistentes ni de otra empresa.</p>
          ) : null}

          <form className="auth-form" onSubmit={handleCreateEstimate}>
            <label className="form-control">
              <span>Cliente</span>
              <select className="select" value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })} required>
                <option value="">Seleccionar cliente</option>
                {clients.map((client) => (
                  <option value={client.clientId} key={client.clientId}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span>Titulo de la cotizacion</span>
              <input className="input" placeholder="Ej. Remodelacion de bano principal" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            </label>
            <label className="form-control">
              <span>Descripcion / alcance del trabajo</span>
              <textarea className="input crm-textarea" placeholder="Describe que incluye el trabajo, condiciones principales o resumen para el cliente." value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} />
            </label>
            <div className="grid proof-grid">
              <label className="form-control">
                <span>Plantilla del PDF</span>
                <select className="select" value={form.templateId} onChange={(event) => setForm({ ...form, templateId: event.target.value as EstimateInput["templateId"] })}>
                  <option value="estimate_classic_blue">Clasica azul construccion</option>
                  <option value="estimate_cleaning_teal">Limpieza teal</option>
                </select>
              </label>
              <label className="form-control">
                <span>Proyecto / obra</span>
                <input className="input" value={form.project?.name || ""} onChange={(event) => setForm({ ...form, project: { ...form.project, name: event.target.value } })} />
              </label>
              <label className="form-control">
                <span>Direccion de obra</span>
                <input className="input" value={form.project?.address || ""} onChange={(event) => setForm({ ...form, project: { ...form.project, address: event.target.value } })} />
              </label>
              <label className="form-control">
                <span>Resumen de obra</span>
                <input className="input" value={form.project?.overview || ""} onChange={(event) => setForm({ ...form, project: { ...form.project, overview: event.target.value } })} />
              </label>
            </div>
            <div className="grid proof-grid">
              <label className="form-control">
                <span>IVA / impuesto %</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                  value={form.taxRate || ""}
                  onChange={(event) => setForm({ ...form, taxRate: Number(event.target.value) })}
                />
              </label>
              <label className="form-control">
                <span>Moneda</span>
                <select className="select" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}>
                  <option value="USD">USD</option>
                  <option value="COP">COP</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
              <label className="form-control">
                <span>Pais / mercado</span>
                <select className="select" value={form.countryProfile} onChange={(event) => setForm({ ...form, countryProfile: event.target.value as EstimateInput["countryProfile"] })}>
                  <option value="US">Estados Unidos</option>
                  <option value="CO">Colombia</option>
                  <option value="ES">Espana</option>
                </select>
              </label>
              <label className="form-control">
                <span>Idioma documento</span>
                <select className="select" value={form.documentLanguage} onChange={(event) => setForm({ ...form, documentLanguage: event.target.value as EstimateInput["documentLanguage"] })}>
                  <option value="es">Espanol</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>

            <div className="crm-detail-panel">
              <div className="card-title-row">
                <h3 className="alert-title">Desglose economico</h3>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={Boolean(form.costBreakdown?.enabled)}
                    onChange={(event) => setForm({ ...form, costBreakdown: { ...(form.costBreakdown || createEmptyCostBreakdown()), enabled: event.target.checked } })}
                  />
                  <span>Usar desglose profesional</span>
                </label>
              </div>
              {form.costBreakdown?.enabled ? (
                <div className="document-cost-grid">
                  {costBreakdownFields.map((field) => (
                    <div className="document-cost-row" key={field.key}>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={form.costBreakdown?.[field.key].applies !== false}
                          onChange={(event) => updateCostField(field.key, { applies: event.target.checked })}
                        />
                        <span>{field.label}</span>
                      </label>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.costBreakdown?.[field.key].amount || ""}
                        onChange={(event) => updateCostField(field.key, { amount: Number(event.target.value) })}
                        disabled={form.costBreakdown?.[field.key].applies === false}
                      />
                    </div>
                  ))}
                  <div className="document-cost-row">
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={Boolean(form.costBreakdown.manualTotal.enabled)}
                        onChange={(event) => updateCostField("manualTotal", { enabled: event.target.checked })}
                      />
                      <span>Total final manual</span>
                    </label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.costBreakdown.manualTotal.amount || ""}
                      onChange={(event) => updateCostField("manualTotal", { amount: Number(event.target.value) })}
                      disabled={!form.costBreakdown.manualTotal.enabled}
                    />
                  </div>
                </div>
              ) : (
                <p className="login-security-note">Si no usas desglose, el total se calcula desde las partidas.</p>
              )}
            </div>

            <div className="crm-detail-panel">
              <div className="card-title-row">
                <h3 className="alert-title">Partidas</h3>
                <Button variant="secondary" type="button" icon={<Plus size={15} />} onClick={addItem}>
                  Partida
                </Button>
              </div>
              {form.sections[0].items.map((item, index) => (
                <div className="estimate-real-item" key={index}>
                  <div className="line-item-mobile-heading">Partida {index + 1}</div>
                  <label className="form-control compact-line-control">
                    <span>Servicio o precio base</span>
                    <select
                      className="select"
                      value={item.serviceCatalogItemId || ""}
                      onChange={(event) => applyService(event.target.value, index)}
                    >
                      <option value="">Manual</option>
                      {services.map((service) => (
                        <option value={service.serviceId} key={service.serviceId}>
                          {service.code} - {service.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-control compact-line-control">
                    <span>Descripcion de partida</span>
                    <input
                      className="input"
                      placeholder="Ej. Lavado exterior"
                      value={item.description}
                      onChange={(event) => updateItem("description", event.target.value, index)}
                      required
                    />
                  </label>
                  <label className="form-control compact-line-control">
                    <span>Unidad de medida</span>
                    <select className="select" aria-label={`Unidad de medida de partida ${index + 1}`} value={item.unitCode || (form.unitSystem === "metric" ? "m2" : "sq_ft")} onChange={(event) => updateItem("unitCode", event.target.value, index)}>
                      {(form.unitSystem === "metric" ? metricUnits : imperialUnits).map((unit) => (
                        <option value={unit} key={unit}>{unit}</option>
                      ))}
                    </select>
                  </label>
                  <label className="form-control compact-line-control">
                    <span>Cantidad</span>
                    <input
                      className="input"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      aria-label={`Cantidad de partida ${index + 1}`}
                      placeholder="Cantidad"
                      value={item.quantity || ""}
                      onChange={(event) => updateItem("quantity", event.target.value, index)}
                      required
                    />
                  </label>
                  <label className="form-control compact-line-control">
                    <span>Precio unitario</span>
                    <input
                      className="input"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      aria-label={`Precio unitario de partida ${index + 1}`}
                      placeholder="Precio unitario"
                      value={item.unitPrice || ""}
                      onChange={(event) => updateItem("unitPrice", event.target.value, index)}
                      required
                    />
                  </label>
                  <strong>{formatMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0), form.currency || "EUR")}</strong>
                </div>
              ))}
              <div className="line-item-bottom-actions">
                <Button variant="secondary" type="button" icon={<Plus size={15} />} onClick={addItem}>
                  Agregar otra partida
                </Button>
              </div>
              <div className="session-summary">
                <span>Subtotal</span>
                <strong>{formatMoney(formSubtotal, form.currency || "EUR")}</strong>
                <span>Impuesto</span>
                <strong>{formatMoney(formTax, form.currency || "EUR")}</strong>
                <span>Total</span>
                <strong>{formatMoney(formTotal, form.currency || "EUR")}</strong>
              </div>
            </div>

            <div className="form-actions modal-form-actions">
              <Button variant="primary" type="submit" icon={<Save size={16} />} disabled={saving || clients.length === 0}>
                Crear cotizacion
              </Button>
            </div>
          </form>
      </BasicModal>

      <BasicModal
        title={detail ? `${detail.estimate.estimateNumber} - ${detail.estimate.title}` : "Detalle de cotizacion"}
        open={Boolean(detail)}
        onClose={() => {
          setSelectedEstimateId(null);
          setDetail(null);
        }}
        size="wide"
        footer={null}
      >
        {detail ? (
        <div className="document-detail-modal">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Detalle de cotizacion</h2>
              <p className="activity-meta">{detail.estimate.clientName}</p>
            </div>
            <div className="crm-client-actions">
              <Button variant="secondary" type="button" onClick={handlePrepareEmail} disabled={saving}>
                Enviar / reenviar
              </Button>
              <Button variant="secondary" type="button" onClick={() => requestEstimateAction("review")} disabled={saving || detail.estimate.status === "approved" || detail.estimate.status === "cancelled"}>
                En revision
              </Button>
              <Button variant="secondary" type="button" onClick={() => requestEstimateAction("reject")} disabled={saving || detail.estimate.status === "approved" || detail.estimate.status === "cancelled" || detail.estimate.status === "rejected"}>
                Rechazar
              </Button>
              <Button variant="secondary" type="button" icon={<XCircle size={16} />} onClick={() => requestEstimateAction("cancel")} disabled={saving || detail.estimate.status === "approved" || detail.estimate.status === "cancelled"}>
                Cancelar
              </Button>
              <Button variant="secondary" type="button" icon={<Download size={16} />} onClick={() => void handleDownloadPdf()} disabled={saving}>
                PDF
              </Button>
              <Button variant="secondary" type="button" icon={<Printer size={16} />} onClick={() => void handlePrint()} disabled={saving}>
                Abrir PDF
              </Button>
              <Button variant="primary" type="button" icon={<CheckCircle2 size={16} />} onClick={() => requestEstimateAction("approve")} disabled={saving || detail.estimate.status === "approved"}>
                Aprobar
              </Button>
              <Button variant="primary" type="button" icon={<ReceiptIcon />} onClick={() => requestEstimateAction("invoice")} disabled={saving || detail.estimate.status !== "approved"}>
                Crear factura para cobrar
              </Button>
            </div>
          </div>
          <div className="responsive-table">
            <div className="table-header estimate-items-grid">
              <span>Seccion</span>
              <span>Descripcion</span>
              <span>Cantidad</span>
              <span>Unidad</span>
              <span>Precio</span>
              <span>Total</span>
            </div>
            {detail.sections.flatMap((section) =>
              section.items.map((item) => (
                <article className="table-row estimate-items-grid" key={item.itemId}>
                  <strong>{section.title}</strong>
                  <span>{item.description}</span>
                  <span>{item.quantity}</span>
                  <span>{item.unitCode || "unit"}</span>
                  <span>{formatMoney(item.unitPrice, detail.estimate.currency)}</span>
                  <strong>{formatMoney(item.totalAmount, detail.estimate.currency)}</strong>
                </article>
              )),
            )}
          </div>
          <div className="grid two-column crm-real-grid" style={{ marginTop: 16 }}>
            <div className="card">
              <div className="card-title-row">
                <h3 className="card-title">Versiones</h3>
                <StatusBadge label={`${detail.versions.length} registros`} tone="info" />
              </div>
              <div className="responsive-table">
                {detail.versions.map((version) => (
                  <article className="table-row payment-row-grid" key={version.versionId}>
                    <strong>v{version.versionNumber}</strong>
                    <span>{formatMoney(version.totalAmount, detail.estimate.currency)}</span>
                    <StatusBadge label={version.status} tone="neutral" />
                    <span>{new Date(version.createdAt).toLocaleString()}</span>
                  </article>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-title-row">
                <h3 className="card-title">Historial</h3>
                <StatusBadge label={`${detail.history?.length || 0} eventos`} tone="success" />
              </div>
              <div className="responsive-table">
                {(detail.history || []).length === 0 ? <EmptyState title="Sin eventos" description="Los cambios de estado y auditoria apareceran aqui." /> : null}
                {(detail.history || []).map((event) => (
                  <article className="table-row payment-row-grid" key={`${event.action}-${event.createdAt}`}>
                    <strong>{historyLabel(event.action)}</strong>
                    <span>{statusLabels[String(event.metadata?.toStatus || "")] || String(event.metadata?.toStatus || "") || "Registro"}</span>
                    <StatusBadge label={event.severity || "info"} tone={event.severity === "warning" ? "warning" : "success"} />
                    <span>{new Date(event.createdAt).toLocaleString()}</span>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
        ) : null}
      </BasicModal>

      <BasicModal
        title={pendingAction ? estimateActionCopy[pendingAction].title : "Confirmar accion"}
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        footer={null}
      >
        {pendingAction ? (
          <form className="auth-form" onSubmit={executeEstimateAction}>
            <p className="activity-meta">{estimateActionCopy[pendingAction].description}</p>
            <div className="segmented-actions modal-form-actions">
              <Button variant="secondary" type="button" onClick={() => setPendingAction(null)} disabled={saving}>
                Volver
              </Button>
              <Button variant="primary" type="submit" icon={pendingAction === "invoice" ? <ReceiptIcon /> : <CheckCircle2 size={16} />} disabled={saving}>
                {estimateActionCopy[pendingAction].confirmLabel}
              </Button>
            </div>
          </form>
        ) : null}
      </BasicModal>
    </section>
  );
}

function ReceiptIcon() {
  return <FileText size={16} />;
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
      <span className="stat-note">Datos calculados en PostgreSQL para el tenant activo</span>
    </article>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function historyLabel(action: string) {
  return {
    "estimates.created": "Creada",
    "estimates.status.updated": "Estado",
    "estimates.updated": "Actualizada",
    "estimates.version.created": "Version",
    "estimates.approved": "Aprobada",
  }[action] || action;
}

function dispatchDataChanged(module: string) {
  window.dispatchEvent(new CustomEvent("constriqo:data-changed", { detail: { module } }));
}
