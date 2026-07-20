import { AlertTriangle, Building2, CalendarClock, Database, KeyRound, LogOut, Plus, RefreshCw, ShieldCheck, Users } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { AuthenticatedSession } from "../../../app/auth/authClient";
import { BasicModal } from "../../../shared/components/BasicModal";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import {
  listSuperAdminTenants,
  createTenantFromSuperAdmin,
  updateTenantLicense,
  type CreateTenantInput,
  type LicenseDurationPreset,
  type LicenseStatus,
  type SuperAdminTenant,
  type TenantLicenseInput,
} from "../api/superAdminClient";

type SuperAdminWorkspaceProps = {
  session: AuthenticatedSession;
  busy?: boolean;
  onLogout: () => void;
};

const statusLabels: Record<LicenseStatus | "missing", string> = {
  trial: "Prueba",
  active: "Activa",
  past_due: "Pago pendiente",
  suspended: "Suspendida",
  expired: "Vencida",
  revoked: "Revocada",
  missing: "Sin licencia",
};

const statusTone: Record<LicenseStatus | "missing", "neutral" | "info" | "warning" | "success" | "danger"> = {
  trial: "info",
  active: "success",
  past_due: "warning",
  suspended: "danger",
  expired: "danger",
  revoked: "danger",
  missing: "neutral",
};

const presetLabels: Record<LicenseDurationPreset, string> = {
  trial_7d: "Prueba 7 dias",
  trial_30d: "Prueba 30 dias",
  one_year: "1 año",
  two_years: "2 años",
  manual: "Fecha manual",
};

export function SuperAdminWorkspace({ session, busy, onLogout }: SuperAdminWorkspaceProps) {
  const [tenants, setTenants] = useState<SuperAdminTenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [createdAdmin, setCreatedAdmin] = useState<{ tenantId: string; email: string; temporaryPassword: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.tenantId === selectedTenantId) || tenants[0] || null,
    [selectedTenantId, tenants],
  );

  const summary = useMemo(() => {
    return tenants.reduce(
      (acc, tenant) => {
        acc.total += 1;
        acc.userCount += tenant.usage.userCount;
        acc.storageSizeBytes += tenant.usage.storageSizeBytes;
        if (tenant.license?.status === "active") {
          acc.active += 1;
        }
        if (tenant.license?.status === "trial") {
          acc.trial += 1;
        }
        const status = tenant.license?.status || "missing";
        if (["suspended", "revoked", "expired", "past_due", "missing"].includes(status)) {
          acc.blocked += 1;
        }
        if (tenant.license?.expiresAt && daysUntil(tenant.license.expiresAt) <= 14 && daysUntil(tenant.license.expiresAt) >= 0) {
          acc.expiringSoon += 1;
        }
        if (tenant.license?.storageQuotaMb && tenant.usage.storageSizeBytes > tenant.license.storageQuotaMb * 1024 * 1024) {
          acc.storageOverQuota += 1;
        }
        return acc;
      },
      { total: 0, active: 0, trial: 0, userCount: 0, storageSizeBytes: 0, blocked: 0, expiringSoon: 0, storageOverQuota: 0 },
    );
  }, [tenants]);

  const licenseAlerts = useMemo(() => {
    return tenants
      .filter((tenant) => {
        const status = tenant.license?.status || "missing";
        return ["suspended", "revoked", "expired", "past_due", "missing"].includes(status)
          || (tenant.license?.expiresAt && daysUntil(tenant.license.expiresAt) <= 14)
          || (tenant.license?.storageQuotaMb && tenant.usage.storageSizeBytes > tenant.license.storageQuotaMb * 1024 * 1024);
      })
      .slice(0, 8);
  }, [tenants]);

  useEffect(() => {
    void refreshTenants();
  }, []);

  async function refreshTenants() {
    setLoading(true);
    setError(null);
    try {
      const result = await listSuperAdminTenants(session.sessionToken);
      setTenants(result.items);
      setSelectedTenantId((current) => current || result.items[0]?.tenantId || null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo cargar la consola Super Admin.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLicenseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenant) {
      return;
    }

    const form = new FormData(event.currentTarget);
    const input: TenantLicenseInput = {
      status: String(form.get("status")) as LicenseStatus,
      planCode: String(form.get("planCode")) as TenantLicenseInput["planCode"],
      durationPreset: String(form.get("durationPreset")) as LicenseDurationPreset,
      startsAt: String(form.get("startsAt") || ""),
      expiresAt: String(form.get("expiresAt") || ""),
      seatsLimit: Number(form.get("seatsLimit") || 5),
      storageQuotaMb: Number(form.get("storageQuotaMb") || 500),
      features: {
        marketingAddon: form.get("marketingAddon") === "on",
        photoEvidenceAddon: form.get("photoEvidenceAddon") === "on",
      },
      notes: String(form.get("notes") || ""),
    };

    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      await updateTenantLicense(session.sessionToken, selectedTenant.tenantId, input);
      await refreshTenants();
      setLicenseOpen(false);
      setNotice("Licencia actualizada correctamente.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar la licencia.");
    } finally {
      setSaving(false);
    }
  }

  async function applyQuickLicenseAction(action: "suspend" | "reactivate" | "extend_one_year") {
    if (!selectedTenant) {
      return;
    }
    const currentLicense = selectedTenant.license;
    const nextInput: TenantLicenseInput = {
      status: action === "suspend" ? "suspended" : "active",
      planCode: currentLicense?.planCode || "starter",
      durationPreset: action === "extend_one_year" ? "one_year" : currentLicense?.durationPreset || "one_year",
      startsAt: new Date().toISOString(),
      expiresAt: currentLicense?.expiresAt || "",
      seatsLimit: currentLicense?.seatsLimit || 5,
      storageQuotaMb: currentLicense?.storageQuotaMb || 500,
      features: currentLicense?.features || {},
      notes: currentLicense?.notes || "",
    };

    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      await updateTenantLicense(session.sessionToken, selectedTenant.tenantId, nextInput);
      await refreshTenants();
      setNotice(action === "suspend" ? "Cliente suspendido correctamente." : "Licencia actualizada correctamente.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo aplicar la accion.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTenantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input: CreateTenantInput = {
      companyName: String(form.get("companyName") || ""),
      industryProfile: String(form.get("industryProfile") || "construction") as CreateTenantInput["industryProfile"],
      currency: String(form.get("currency") || "USD") as CreateTenantInput["currency"],
      locale: String(form.get("locale") || ""),
      timezone: String(form.get("timezone") || ""),
      adminEmail: String(form.get("adminEmail") || ""),
      adminName: String(form.get("adminName") || ""),
      durationPreset: String(form.get("durationPreset") || "trial_30d") as LicenseDurationPreset,
      status: String(form.get("status") || "trial") as LicenseStatus,
      planCode: String(form.get("planCode") || "starter") as CreateTenantInput["planCode"],
      seatsLimit: Number(form.get("seatsLimit") || 5),
      storageQuotaMb: Number(form.get("storageQuotaMb") || 500),
      notes: String(form.get("notes") || ""),
    };

    setSaving(true);
    setNotice(null);
    setError(null);
    setCreatedAdmin(null);
    try {
      const result = await createTenantFromSuperAdmin(session.sessionToken, input);
      await refreshTenants();
      setSelectedTenantId(result.tenant.tenantId);
      setCreateOpen(false);
      setCreatedAdmin({
        tenantId: result.tenant.tenantId,
        email: result.initialAdmin.email,
        temporaryPassword: result.initialAdmin.temporaryPassword,
      });
      setNotice("Cliente creado correctamente. Entrega las credenciales temporales al administrador.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo crear el cliente.");
    } finally {
      setSaving(false);
    }
  }

  function handleLogoutClick() {
    if (window.confirm("¿Estas seguro de cerrar sesion de Super Admin?")) {
      onLogout();
    }
  }

  return (
    <main className="production-shell super-admin-shell">
      <header className="production-topbar">
        <div className="brand-lockup">
          <span className="brand-mark">CF</span>
          <div>
            <p className="brand-name">Constriqo Provider</p>
            <p className="brand-subtitle">Consola Super Admin</p>
          </div>
        </div>
        <Button variant="secondary" icon={<LogOut size={16} />} onClick={handleLogoutClick} disabled={busy || saving}>
          Cerrar sesion
        </Button>
      </header>

      <section className="production-main">
        <PageHeader
          eyebrow="SaaS privado"
          title="Clientes y licencias"
          description="Control proveedor para activar, suspender o extender licencias sin entrar al espacio de trabajo de cada empresa."
          actions={
            <div className="segmented-actions">
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen((value) => !value)} disabled={saving}>
                Crear cliente
              </Button>
              <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => void refreshTenants()} disabled={loading || saving}>
                Actualizar
              </Button>
            </div>
          }
        />

        {notice ? <div className="inline-alert success">{notice}</div> : null}
        {error ? <div className="inline-alert danger">{error}</div> : null}
        {createdAdmin ? (
          <div className="inline-alert success">
            <strong>Credenciales temporales:</strong> codigo empresa {createdAdmin.tenantId}, correo {createdAdmin.email}, clave {createdAdmin.temporaryPassword}. Al primer acceso debe configurar MFA.
          </div>
        ) : null}

        <BasicModal title="Crear empresa SaaS" open={createOpen} onClose={() => setCreateOpen(false)} size="wide" footer={null}>
          <section className="surface-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Alta de cliente</p>
                <h2>Datos del nuevo cliente</h2>
              </div>
            </div>
            <form className="form-grid" onSubmit={handleCreateTenantSubmit}>
              <label>
                <span>Nombre empresa</span>
                <input className="input" name="companyName" required />
              </label>
              <label>
                <span>Administrador inicial</span>
                <input className="input" name="adminName" defaultValue="Administrador" required />
              </label>
              <label>
                <span>Correo administrador</span>
                <input className="input" type="email" name="adminEmail" required />
              </label>
              <label>
                <span>Industria</span>
                <select className="select" name="industryProfile" defaultValue="construction">
                  <option value="construction">Construccion</option>
                  <option value="cleaning">Aseo</option>
                </select>
              </label>
              <label>
                <span>Moneda</span>
                <select className="select" name="currency" defaultValue="USD">
                  <option value="USD">USD</option>
                  <option value="COP">COP</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
              <label>
                <span>Duracion inicial</span>
                <select className="select" name="durationPreset" defaultValue="trial_30d">
                  {Object.entries(presetLabels).map(([value, label]) => (
                    <option value={value} key={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Estado</span>
                <select className="select" name="status" defaultValue="trial">
                  <option value="trial">Prueba</option>
                  <option value="active">Activa</option>
                </select>
              </label>
              <label>
                <span>Plan</span>
                <select className="select" name="planCode" defaultValue="starter">
                  <option value="starter">Starter</option>
                  <option value="growth">Growth</option>
                  <option value="dedicated">Dedicated</option>
                </select>
              </label>
              <label>
                <span>Usuarios incluidos</span>
                <input className="input" type="number" min={1} name="seatsLimit" defaultValue={5} />
              </label>
              <label>
                <span>Almacenamiento MB</span>
                <input className="input" type="number" min={1} name="storageQuotaMb" defaultValue={500} />
              </label>
              <label>
                <span>Locale opcional</span>
                <input className="input" name="locale" placeholder="en-US, es-CO, es-ES" />
              </label>
              <label>
                <span>Zona horaria opcional</span>
                <input className="input" name="timezone" placeholder="America/Denver" />
              </label>
              <label>
                <span>Notas internas</span>
                <textarea className="textarea" name="notes" rows={3} />
              </label>
              <div className="form-actions">
                <Button type="submit" disabled={saving} icon={<KeyRound size={16} />}>
                  {saving ? "Creando..." : "Crear cliente y admin"}
                </Button>
              </div>
            </form>
          </section>
        </BasicModal>

        <section className="stats-grid">
          <StatCard label="Empresas" value={String(summary.total)} note="Clientes SaaS registrados" tone="info" icon={Building2} />
          <StatCard label="Licencias activas" value={String(summary.active)} note="Clientes operativos" tone="positive" icon={ShieldCheck} />
          <StatCard label="Alertas" value={String(summary.blocked + summary.expiringSoon + summary.storageOverQuota)} note="Bloqueo, vencimiento o cuota" tone="danger" icon={AlertTriangle} />
          <StatCard label="Uso archivos" value={formatBytes(summary.storageSizeBytes)} note={`${summary.storageOverQuota} sobre cuota`} tone="info" icon={Database} />
        </section>

        <section className="stats-grid">
          <StatCard label="Pruebas" value={String(summary.trial)} note="7 o 30 dias" tone="warning" icon={Users} />
          <StatCard label="Bloqueadas" value={String(summary.blocked)} note="Suspendidas, vencidas o sin licencia" tone="danger" icon={ShieldCheck} />
          <StatCard label="Vencen pronto" value={String(summary.expiringSoon)} note="Proximos 14 dias" tone="warning" icon={CalendarClock} />
          <StatCard label="Usuarios" value={String(summary.userCount)} note="Total global en tenants" tone="info" icon={Users} />
        </section>

        {licenseAlerts.length > 0 ? (
          <section className="surface-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Alertas proveedor</p>
                <h2>Requieren revision</h2>
              </div>
              <StatusBadge label={`${licenseAlerts.length} alertas`} tone="warning" />
            </div>
            <div className="responsive-table">
              {licenseAlerts.map((tenant) => {
                const status = tenant.license?.status || "missing";
                const quotaExceeded = Boolean(tenant.license?.storageQuotaMb && tenant.usage.storageSizeBytes > tenant.license.storageQuotaMb * 1024 * 1024);
                const days = tenant.license?.expiresAt ? daysUntil(tenant.license.expiresAt) : null;
                return (
                  <button
                    className="table-row super-admin-alert-row"
                    type="button"
                    key={tenant.tenantId}
                    onClick={() => setSelectedTenantId(tenant.tenantId)}
                  >
                    <strong>{tenant.companyName}</strong>
                    <StatusBadge label={statusLabels[status]} tone={statusTone[status]} />
                    <span>{days === null ? "Sin vencimiento" : days < 0 ? "Vencida" : `Vence en ${days} dias`}</span>
                    <span>{quotaExceeded ? "Sobre cuota" : formatBytes(tenant.usage.storageSizeBytes)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="super-admin-grid">
          <article className="surface-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Empresas</p>
                <h2>Tenants gestionados</h2>
              </div>
            </div>

            {loading ? <EmptyState title="Cargando empresas" description="Consultando licencias y uso disponible." /> : null}
            {!loading && tenants.length === 0 ? <EmptyState title="Sin clientes" description="Cuando instales el primer cliente aparecera aqui." /> : null}

            <div className="responsive-table">
              {tenants.map((tenant) => {
                const status = tenant.license?.status || "missing";
                return (
                  <button
                    className={`table-row super-admin-tenant-row ${selectedTenant?.tenantId === tenant.tenantId ? "selected" : ""}`}
                    type="button"
                    key={tenant.tenantId}
                    onClick={() => setSelectedTenantId(tenant.tenantId)}
                  >
                    <span>
                      <strong>{tenant.companyName}</strong>
                      <small>{tenant.tenantId}</small>
                    </span>
                    <StatusBadge label={statusLabels[status]} tone={statusTone[status]} />
                    <span>{tenant.license ? formatDate(tenant.license.expiresAt) : "Pendiente"}</span>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="surface-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Licencia</p>
                <h2>{selectedTenant?.companyName || "Selecciona empresa"}</h2>
              </div>
              {selectedTenant?.license ? (
                <StatusBadge label={statusLabels[selectedTenant.license.status]} tone={statusTone[selectedTenant.license.status]} />
              ) : null}
            </div>

            {selectedTenant ? (
              <>
              <div className="segmented-actions" style={{ marginBottom: 14 }}>
                <Button variant="primary" type="button" onClick={() => setLicenseOpen(true)} disabled={saving}>
                  Editar licencia
                </Button>
                <Button variant="secondary" type="button" onClick={() => void applyQuickLicenseAction("reactivate")} disabled={saving}>
                  Reactivar
                </Button>
                <Button variant="secondary" type="button" onClick={() => void applyQuickLicenseAction("extend_one_year")} disabled={saving}>
                  Extender 1 año
                </Button>
                <Button variant="danger" type="button" onClick={() => void applyQuickLicenseAction("suspend")} disabled={saving}>
                  Suspender
                </Button>
              </div>
              <div className="activity-list">
                <article className="activity-item">
                  <span className="activity-icon"><ShieldCheck size={18} /></span>
                  <div>
                    <strong>{selectedTenant.license ? statusLabels[selectedTenant.license.status] : "Sin licencia"}</strong>
                    <span>{selectedTenant.license ? `${selectedTenant.license.planCode} · vence ${formatDate(selectedTenant.license.expiresAt)}` : "Crea una licencia para habilitar el cliente."}</span>
                  </div>
                </article>
                <article className="activity-item">
                  <span className="activity-icon"><Database size={18} /></span>
                  <div>
                    <strong>{formatBytes(selectedTenant.usage.storageSizeBytes)}</strong>
                    <span>{selectedTenant.usage.userCount} usuarios · {selectedTenant.usage.documentCount} documentos</span>
                  </div>
                </article>
              </div>
              <BasicModal title="Editar licencia del cliente" open={licenseOpen} onClose={() => setLicenseOpen(false)} size="wide" footer={null}>
              <form className="form-grid" onSubmit={handleLicenseSubmit}>
                <label>
                  <span>Duracion</span>
                  <select className="select" name="durationPreset" defaultValue={selectedTenant.license?.durationPreset || "one_year"}>
                    {Object.entries(presetLabels).map(([value, label]) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Estado</span>
                  <select className="select" name="status" defaultValue={selectedTenant.license?.status || "active"}>
                    {Object.entries(statusLabels).filter(([value]) => value !== "missing").map(([value, label]) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Plan</span>
                  <select className="select" name="planCode" defaultValue={selectedTenant.license?.planCode || "starter"}>
                    <option value="starter">Starter</option>
                    <option value="growth">Growth</option>
                    <option value="dedicated">Dedicated</option>
                  </select>
                </label>
                <label>
                  <span>Inicio</span>
                  <input className="input" type="date" name="startsAt" defaultValue={toDateInput(selectedTenant.license?.startsAt)} />
                </label>
                <label>
                  <span>Vencimiento manual</span>
                  <input className="input" type="date" name="expiresAt" defaultValue={toDateInput(selectedTenant.license?.expiresAt)} />
                </label>
                <label>
                  <span>Usuarios incluidos</span>
                  <input className="input" type="number" min={1} name="seatsLimit" defaultValue={selectedTenant.license?.seatsLimit || 5} />
                </label>
                <label>
                  <span>Almacenamiento MB</span>
                  <input className="input" type="number" min={1} name="storageQuotaMb" defaultValue={selectedTenant.license?.storageQuotaMb || 500} />
                </label>
                <label>
                  <span>Notas internas</span>
                  <textarea className="textarea" name="notes" rows={3} defaultValue={selectedTenant.license?.notes || ""} />
                </label>
                <label className="checkbox-row">
                  <input type="checkbox" name="marketingAddon" defaultChecked={Boolean(selectedTenant.license?.features?.marketingAddon)} />
                  <span>Marketing activo</span>
                </label>
                <label className="checkbox-row">
                  <input type="checkbox" name="photoEvidenceAddon" defaultChecked={Boolean(selectedTenant.license?.features?.photoEvidenceAddon)} />
                  <span>Evidencias fotograficas activo</span>
                </label>

                <div className="form-actions">
                  <Button type="submit" disabled={saving || loading} icon={<ShieldCheck size={16} />}>
                    {saving ? "Guardando..." : "Guardar licencia"}
                  </Button>
                </div>
              </form>
              </BasicModal>
              </>
            ) : (
              <EmptyState title="Selecciona un cliente" description="El formulario de licencia aparecera aqui." />
            )}
          </article>
        </section>

        <footer className="provider-footer">Constriqo SaaS Provider Console. Acceso privado del proveedor.</footer>
      </section>
    </main>
  );
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Sin fecha";
  }
  return new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date(value));
}

function toDateInput(value?: string | null) {
  if (!value) {
    return "";
  }
  return new Date(value).toISOString().slice(0, 10);
}

function formatBytes(bytes: number) {
  if (!bytes) {
    return "0 MB";
  }
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function daysUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}
