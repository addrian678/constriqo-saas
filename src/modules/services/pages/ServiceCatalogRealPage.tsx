import { Archive, Calculator, Plus, RefreshCw, Save } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type { AuthenticatedSession } from "../../../app/auth/authClient";
import { Button } from "../../../shared/components/Button";
import { BasicModal } from "../../../shared/components/BasicModal";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { getTenantSettings, type TenantSettings } from "../../organization/api/organizationClient";
import {
  archiveService,
  createService,
  listServices,
  type ServiceCatalogInput,
  type ServiceCatalogItem,
  type UnitCode,
} from "../api/serviceCatalogClient";

type ServiceCatalogRealPageProps = {
  session: AuthenticatedSession;
};

const metricUnits: Array<{ value: UnitCode; label: string }> = [
  { value: "m2", label: "m2" },
  { value: "linear_m", label: "metro lineal" },
  { value: "m", label: "metro" },
  { value: "cm", label: "centimetro" },
  { value: "unit", label: "unidad" },
  { value: "hour", label: "hora" },
  { value: "day", label: "dia" },
];

const imperialUnits: Array<{ value: UnitCode; label: string }> = [
  { value: "sq_ft", label: "sq ft" },
  { value: "linear_ft", label: "linear ft" },
  { value: "ft", label: "ft" },
  { value: "in", label: "inch" },
  { value: "unit", label: "unit" },
  { value: "hour", label: "hour" },
  { value: "day", label: "day" },
];

function emptyForm(settings?: TenantSettings | null): ServiceCatalogInput {
  const unitSystem = settings?.unitSystem || "imperial";
  return {
    code: "",
    name: "",
    category: "general",
    description: "",
    countryProfile: settings?.countryProfile || "US",
    unitSystem,
    unitCode: unitSystem === "metric" ? "m2" : "sq_ft",
    currency: settings?.currency || "USD",
    unitPrice: 0,
    unitCost: 0,
    defaultTaxRate: 0,
    marginPercent: 0,
    minimumQuantity: 1,
    inclusions: "",
    exclusions: "",
    conditions: "",
  };
}

export function ServiceCatalogRealPage({ session }: ServiceCatalogRealPageProps) {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [form, setForm] = useState<ServiceCatalogInput>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(options: { preserveMessage?: boolean } = {}) {
    setLoading(true);
    if (!options.preserveMessage) {
      setMessage(null);
    }
    try {
      const [nextSettings, nextServices] = await Promise.all([
        getTenantSettings(session.sessionToken),
        listServices(session.sessionToken),
      ]);
      setSettings(nextSettings);
      setForm((current) => (current.code || current.name ? current : emptyForm(nextSettings)));
      setServices(nextServices);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar servicios.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await createService(session.sessionToken, { ...form, code: generateServiceCode(form, services) });
      setForm(emptyForm(settings));
      setShowCreateForm(false);
      setMessage("Servicio creado con auditoria y aislamiento por empresa.");
      dispatchDataChanged("services");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el servicio.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(serviceId: string) {
    setSaving(true);
    setMessage(null);
    try {
      await archiveService(session.sessionToken, serviceId);
      setMessage("Servicio archivado. Las cotizaciones historicas conservan su snapshot.");
      dispatchDataChanged("services");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo archivar el servicio.");
    } finally {
      setSaving(false);
    }
  }

  const unitOptions = form.unitSystem === "metric" ? metricUnits : imperialUnits;

  return (
    <section className="production-module-content">
      <PageHeader
        eyebrow="Servicios y precios"
        title="Catalogo para cotizaciones"
        description="Precios por tenant, unidad, moneda, impuesto y margen. Las cotizaciones guardan snapshot para no cambiar historicos."
        actions={
          <div className="segmented-actions">
            <Button variant="primary" type="button" icon={<Plus size={16} />} onClick={() => setShowCreateForm((value) => !value)}>
              Crear servicio
            </Button>
            <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>
              Actualizar
            </Button>
          </div>
        }
      />

      {message ? <p className="login-notice">{message}</p> : null}

      <section className="grid crm-real-grid">
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Servicios activos</h2>
            <StatusBadge label={loading ? "Cargando" : `${services.length} servicios`} tone="info" />
          </div>
          {!loading && services.length === 0 ? (
            <EmptyState title="Sin servicios todavia" description="Crea servicios reales para que cotizaciones calcule por m2, sq ft, hora o unidad." />
          ) : (
            <div className="crm-client-list">
              {services.map((service) => (
                <article className="activity-item crm-client-row" key={service.serviceId}>
                  <span className="activity-icon"><Calculator size={18} /></span>
                  <button className="crm-client-button" type="button">
                    <strong>{service.code} - {service.name}</strong>
                    <span>
                      {service.category} · {service.unitCode} · {formatMoney(service.unitPrice, service.currency)} · impuesto {service.defaultTaxRate}%
                    </span>
                  </button>
                  <div className="crm-client-actions">
                    <StatusBadge label={service.unitSystem === "metric" ? "Metrico" : "Imperial"} tone="neutral" />
                    <Button variant="secondary" type="button" icon={<Archive size={15} />} onClick={() => void handleArchive(service.serviceId)} disabled={saving}>
                      Archivar
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <BasicModal title="Nuevo servicio" open={showCreateForm} onClose={() => setShowCreateForm(false)} size="wide" footer={null}>
        <div className="card-title-row">
          <span className="activity-meta">El codigo se genera automaticamente al guardar.</span>
          <StatusBadge label={`Codigo ${generateServiceCode(form, services)}`} tone="success" />
        </div>
          <form className="auth-form" onSubmit={handleCreate}>
            <div className="grid proof-grid">
              <label className="form-control">
                <span>Categoria</span>
                <input className="input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required />
              </label>
              <label className="form-control">
                <span>Codigo automatico</span>
                <input className="input" value={generateServiceCode(form, services)} readOnly aria-readonly="true" />
              </label>
            </div>
            <label className="form-control">
              <span>Nombre del servicio</span>
              <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </label>
            <label className="form-control">
              <span>Descripcion</span>
              <textarea className="input crm-textarea" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </label>
            <div className="grid proof-grid">
              <label className="form-control">
                <span>Sistema de unidades</span>
                <select
                  className="select"
                  value={form.unitSystem}
                  onChange={(event) => {
                    const unitSystem = event.target.value as ServiceCatalogInput["unitSystem"];
                    setForm({ ...form, unitSystem, unitCode: unitSystem === "metric" ? "m2" : "sq_ft" });
                  }}
                >
                  <option value="imperial">Imperial</option>
                  <option value="metric">Metrico</option>
                </select>
              </label>
              <label className="form-control">
                <span>Unidad</span>
                <select className="select" value={form.unitCode} onChange={(event) => setForm({ ...form, unitCode: event.target.value as UnitCode })}>
                  {unitOptions.map((unit) => (
                    <option value={unit.value} key={unit.value}>{unit.label}</option>
                  ))}
                </select>
              </label>
              <label className="form-control">
                <span>Precio unitario</span>
                <input className="input" type="number" min="0" step="0.01" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: Number(event.target.value) })} required />
              </label>
              <label className="form-control">
                <span>Impuesto %</span>
                <input className="input" type="number" min="0" max="100" step="0.01" value={form.defaultTaxRate} onChange={(event) => setForm({ ...form, defaultTaxRate: Number(event.target.value) })} />
              </label>
            </div>
            <Button variant="primary" type="submit" icon={<Save size={16} />} disabled={saving}>
              Crear servicio
            </Button>
          </form>
      </BasicModal>
    </section>
  );
}

function formatMoney(value: number, currency: string) {
  const locale = currency === "USD" ? "en-US" : currency === "COP" ? "es-CO" : "es-ES";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "COP" ? 0 : 2,
  }).format(value || 0);
}

function generateServiceCode(form: ServiceCatalogInput, services: ServiceCatalogItem[]) {
  const source = `${form.category || "servicio"} ${form.name || ""}`.trim() || "servicio";
  const base = source
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 18)
    .toUpperCase() || "SERVICIO";
  const existing = new Set(services.map((service) => service.code.toUpperCase()));
  if (!existing.has(base)) {
    return base;
  }
  let index = 2;
  while (existing.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

function dispatchDataChanged(module: string) {
  window.dispatchEvent(new CustomEvent("constriqo:data-changed", { detail: { module } }));
}
