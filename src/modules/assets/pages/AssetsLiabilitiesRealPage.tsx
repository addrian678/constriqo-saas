import { Building2, Landmark, PackageCheck, Plus, RefreshCw, Save, ShieldCheck } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { AuthenticatedSession } from "../../../app/auth/authClient";
import { Button } from "../../../shared/components/Button";
import { BasicModal } from "../../../shared/components/BasicModal";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { getFinanceDashboard } from "../../finance/api/financeClient";
import {
  createAsset,
  createLiability,
  listAssets,
  listLiabilities,
  type Asset,
  type AssetInput,
  type AssetStatus,
  type Liability,
  type LiabilityInput,
  type LiabilityStatus,
} from "../api/assetsClient";

type AssetsLiabilitiesRealPageProps = {
  session: AuthenticatedSession;
};

const initialAssetForm: AssetInput = {
  name: "",
  category: "Equipo",
  status: "active",
  bookValue: 0,
  warrantyExpiresAt: "",
};

const initialLiabilityForm: LiabilityInput = {
  lender: "",
  status: "active",
  principalAmount: 0,
  balanceAmount: 0,
  nextDueDate: "",
};

const assetStatusLabels: Record<AssetStatus, string> = {
  active: "Activo",
  maintenance: "Mantenimiento",
  retired: "Retirado",
};

const liabilityStatusLabels: Record<LiabilityStatus, string> = {
  active: "Activo",
  paid: "Pagado",
  defaulted: "En mora",
  cancelled: "Cancelado",
};

export function AssetsLiabilitiesRealPage({ session }: AssetsLiabilitiesRealPageProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [assetForm, setAssetForm] = useState<AssetInput>(initialAssetForm);
  const [liabilityForm, setLiabilityForm] = useState<LiabilityInput>(initialLiabilityForm);
  const [currency, setCurrency] = useState<"USD" | "COP" | "EUR">("USD");
  const [activePanel, setActivePanel] = useState<"asset" | "liability" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const assetTotals = useMemo(() => {
    return assets.reduce(
      (acc, asset) => {
        acc.bookValue += asset.bookValue;
        acc[asset.status] += 1;
        return acc;
      },
      { bookValue: 0, active: 0, maintenance: 0, retired: 0 },
    );
  }, [assets]);

  const liabilityTotals = useMemo(() => {
    return liabilities.reduce(
      (acc, liability) => {
        acc.balanceAmount += liability.balanceAmount;
        acc.principalAmount += liability.principalAmount;
        acc[liability.status] += 1;
        return acc;
      },
      { principalAmount: 0, balanceAmount: 0, active: 0, paid: 0, defaulted: 0, cancelled: 0 },
    );
  }, [liabilities]);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(options: { preserveMessage?: boolean } = {}) {
    setLoading(true);
    if (!options.preserveMessage) {
      setMessage(null);
    }
    try {
      const [assetResult, liabilityResult, financeDashboard] = await Promise.all([
        listAssets(session.sessionToken),
        listLiabilities(session.sessionToken),
        getFinanceDashboard(session.sessionToken),
      ]);
      setAssets(assetResult.items);
      setLiabilities(liabilityResult.items);
      setCurrency(financeDashboard.currency);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar activos y pasivos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await createAsset(session.sessionToken, {
        ...assetForm,
        bookValue: Number(assetForm.bookValue),
        warrantyExpiresAt: assetForm.warrantyExpiresAt || undefined,
      });
      setAssetForm(initialAssetForm);
      setActivePanel(null);
      setMessage("Activo registrado. El balance financiero ya puede usar su valor contable.");
      dispatchDataChanged("assets");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar el activo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateLiability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await createLiability(session.sessionToken, {
        ...liabilityForm,
        principalAmount: Number(liabilityForm.principalAmount),
        balanceAmount: liabilityForm.balanceAmount === undefined ? undefined : Number(liabilityForm.balanceAmount),
        nextDueDate: liabilityForm.nextDueDate || undefined,
      });
      setLiabilityForm(initialLiabilityForm);
      setActivePanel(null);
      setMessage("Pasivo registrado. El balance financiero ya refleja la obligacion.");
      dispatchDataChanged("assets");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar el pasivo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="production-module-content">
      <PageHeader
        eyebrow="Activos y pasivos F9.2"
        title="Patrimonio operativo"
        description="Controla maquinaria, equipos, vehiculos, prestamos y obligaciones. Todo queda aislado por empresa y alimenta el balance."
        actions={
          <div className="segmented-actions">
            <Button variant="primary" type="button" icon={<Plus size={16} />} onClick={() => setActivePanel(activePanel === "asset" ? null : "asset")}>
              Registrar activo
            </Button>
            <Button variant="secondary" type="button" icon={<Plus size={16} />} onClick={() => setActivePanel(activePanel === "liability" ? null : "liability")}>
              Registrar pasivo
            </Button>
            <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>
              Actualizar
            </Button>
          </div>
        }
      />

      {message ? <p className="login-notice">{message}</p> : null}

      <section className="grid stats-grid crm-real-stats">
        <SummaryCard label="Valor activos" value={loading && assets.length === 0 ? "Cargando" : formatMoney(assetTotals.bookValue, currency)} icon={<Building2 size={20} />} />
        <SummaryCard label="Pasivos abiertos" value={loading && liabilities.length === 0 ? "Cargando" : formatMoney(liabilityTotals.balanceAmount, currency)} icon={<Landmark size={20} />} />
        <SummaryCard label="Activos operativos" value={loading && assets.length === 0 ? "Cargando" : assetTotals.active} icon={<PackageCheck size={20} />} />
        <SummaryCard label="Registros auditados" value={loading && assets.length + liabilities.length === 0 ? "Cargando" : assets.length + liabilities.length} icon={<ShieldCheck size={20} />} />
      </section>

      <BasicModal title="Nuevo activo" open={activePanel === "asset"} onClose={() => setActivePanel(null)} size="wide" footer={null}>
        <form className="auth-form" onSubmit={handleCreateAsset}>
          <StatusBadge label="Codigo automatico" tone="success" />
          <div className="grid proof-grid">
            <label className="form-control">
              <span>Nombre</span>
              <input className="input" value={assetForm.name} onChange={(event) => setAssetForm({ ...assetForm, name: event.target.value })} required />
            </label>
            <label className="form-control">
              <span>Categoria</span>
              <input className="input" value={assetForm.category} onChange={(event) => setAssetForm({ ...assetForm, category: event.target.value })} required />
            </label>
            <label className="form-control">
              <span>Estado</span>
              <select className="select" value={assetForm.status} onChange={(event) => setAssetForm({ ...assetForm, status: event.target.value as AssetStatus })}>
                <option value="active">Activo</option>
                <option value="maintenance">Mantenimiento</option>
                <option value="retired">Retirado</option>
              </select>
            </label>
            <label className="form-control">
              <span>Valor contable</span>
              <input className="input" type="number" min="0" step="0.01" value={assetForm.bookValue || ""} onChange={(event) => setAssetForm({ ...assetForm, bookValue: Number(event.target.value) })} required />
            </label>
            <label className="form-control">
              <span>Garantia hasta</span>
              <input className="input" type="date" value={assetForm.warrantyExpiresAt || ""} onChange={(event) => setAssetForm({ ...assetForm, warrantyExpiresAt: event.target.value })} />
            </label>
          </div>
          <Button variant="primary" type="submit" icon={<Save size={16} />} disabled={saving}>
            Guardar activo
          </Button>
        </form>
      </BasicModal>

      <BasicModal title="Nuevo pasivo" open={activePanel === "liability"} onClose={() => setActivePanel(null)} size="wide" footer={null}>
        <form className="auth-form" onSubmit={handleCreateLiability}>
          <StatusBadge label="Referencia automatica" tone="success" />
          <div className="grid proof-grid">
            <label className="form-control">
              <span>Acreedor / entidad</span>
              <input className="input" value={liabilityForm.lender} onChange={(event) => setLiabilityForm({ ...liabilityForm, lender: event.target.value })} required />
            </label>
            <label className="form-control">
              <span>Estado</span>
              <select className="select" value={liabilityForm.status} onChange={(event) => setLiabilityForm({ ...liabilityForm, status: event.target.value as LiabilityStatus })}>
                <option value="active">Activo</option>
                <option value="paid">Pagado</option>
                <option value="defaulted">En mora</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </label>
            <label className="form-control">
              <span>Importe principal</span>
              <input className="input" type="number" min="0" step="0.01" value={liabilityForm.principalAmount || ""} onChange={(event) => setLiabilityForm({ ...liabilityForm, principalAmount: Number(event.target.value) })} required />
            </label>
            <label className="form-control">
              <span>Saldo pendiente</span>
              <input className="input" type="number" min="0" step="0.01" value={liabilityForm.balanceAmount || ""} onChange={(event) => setLiabilityForm({ ...liabilityForm, balanceAmount: Number(event.target.value) })} />
            </label>
            <label className="form-control">
              <span>Proximo vencimiento</span>
              <input className="input" type="date" value={liabilityForm.nextDueDate || ""} onChange={(event) => setLiabilityForm({ ...liabilityForm, nextDueDate: event.target.value })} />
            </label>
          </div>
          <Button variant="primary" type="submit" icon={<Save size={16} />} disabled={saving}>
            Guardar pasivo
          </Button>
        </form>
      </BasicModal>

      <section className="grid two-column crm-real-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Activos</h2>
            <StatusBadge label={loading ? "Cargando" : `${assets.length} registros`} tone="info" />
          </div>
          {!loading && assets.length === 0 ? (
            <EmptyState title="Sin activos todavia" description="Registra maquinaria, herramientas, vehiculos o equipos de la empresa." />
          ) : (
            <div className="crm-client-list">
              {assets.map((asset) => (
                <article className="activity-item crm-client-row" key={asset.assetId}>
                  <span className="activity-icon"><Building2 size={18} /></span>
                  <div className="crm-client-button">
                    <strong>{asset.code} - {asset.name}</strong>
                    <span>{asset.category} · {formatMoney(asset.bookValue, currency)} · garantia {asset.warrantyExpiresAt || "no registrada"}</span>
                  </div>
                  <StatusBadge label={assetStatusLabels[asset.status]} tone={asset.status === "active" ? "success" : asset.status === "maintenance" ? "warning" : "neutral"} />
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Pasivos</h2>
            <StatusBadge label={loading ? "Cargando" : `${liabilities.length} registros`} tone="info" />
          </div>
          {!loading && liabilities.length === 0 ? (
            <EmptyState title="Sin pasivos todavia" description="Registra prestamos, obligaciones o deudas para controlar el balance real." />
          ) : (
            <div className="crm-client-list">
              {liabilities.map((liability) => (
                <article className="activity-item crm-client-row" key={liability.liabilityId}>
                  <span className="activity-icon"><Landmark size={18} /></span>
                  <div className="crm-client-button">
                    <strong>{liability.reference} - {liability.lender}</strong>
                    <span>{formatMoney(liability.balanceAmount, currency)} pendiente · vence {liability.nextDueDate || "sin fecha"}</span>
                  </div>
                  <StatusBadge label={liabilityStatusLabels[liability.status]} tone={liability.status === "active" ? "warning" : liability.status === "paid" ? "success" : "danger"} />
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </section>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
        </div>
        <span className="stat-icon info">{icon}</span>
      </div>
      <span className="stat-note">Aislado por empresa</span>
    </article>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(value || 0);
}

function dispatchDataChanged(module: string) {
  window.dispatchEvent(new CustomEvent("constructflow:data-changed", { detail: { module } }));
}
