import { Bell, CheckCircle2, FileText, Globe2, HardDrive, KeyRound, LogOut, RefreshCw, Save, ShieldCheck, Smartphone, Users } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import type { AuthenticatedSession } from "../../../app/auth/authClient";
import {
  getNativeRuntimeInfo,
  getNotificationConsentStatus,
  requestNotificationConsent,
  type NativeRuntimeInfo,
  type NotificationConsentStatus,
} from "../../../app/native/nativeCapabilities";
import { BasicModal } from "../../../shared/components/BasicModal";
import { Button } from "../../../shared/components/Button";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import {
  acceptRequiredPolicies,
  createTenantUser,
  getCachedTenantSettings,
  getCachedTenantUsage,
  getPrivacyPreferences,
  getTenantUsage,
  getTenantSettings,
  listTenantUsers,
  listPolicyAcceptances,
  resetTenantUserPassword,
  updateTenantSettings,
  updateTenantUser,
  updatePrivacyPreferences,
  type ManagedTenantUserRole,
  type PrivacyPreferences,
  type TenantUsage,
  type TenantSettings,
  type TenantUser,
  type TenantUserInput,
  type TenantUserRole,
  type TenantUserStatus,
} from "../api/organizationClient";

type TenantSettingsRealPageProps = {
  session: AuthenticatedSession;
  busy?: boolean;
  onLogout: () => void;
};

const POLICY_VERSION = "2026-07-14";
const PRIVACY_POLICY_VERSION = "2026-07-15";

const countryDefaults = {
  US: { currency: "USD", unitSystem: "imperial", locale: "en-US", timezone: "America/Denver" },
  CO: { currency: "COP", unitSystem: "metric", locale: "es-CO", timezone: "America/Bogota" },
  ES: { currency: "EUR", unitSystem: "metric", locale: "es-ES", timezone: "Europe/Madrid" },
} as const;

const initialUserForm: TenantUserInput = {
  email: "",
  displayName: "",
  role: "worker",
  password: "",
};

export function TenantSettingsRealPage({ session, busy, onLogout }: TenantSettingsRealPageProps) {
  const [settings, setSettings] = useState<TenantSettings | null>(() => getCachedTenantSettings(session.sessionToken));
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [userForm, setUserForm] = useState<TenantUserInput>(initialUserForm);
  const [temporaryAccess, setTemporaryAccess] = useState<{ email: string; password: string } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [privacyPreferences, setPrivacyPreferences] = useState<PrivacyPreferences | null>(null);
  const [tenantUsage, setTenantUsage] = useState<TenantUsage | null>(() => getCachedTenantUsage(session.sessionToken));
  const [loading, setLoading] = useState(() => !getCachedTenantSettings(session.sessionToken));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [settingsFormOpen, setSettingsFormOpen] = useState(false);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [nativeInfo, setNativeInfo] = useState<NativeRuntimeInfo | null>(null);
  const [notificationConsent, setNotificationConsent] = useState<NotificationConsentStatus>("unsupported");
  const managedUsers = users.filter((user) => isManagedTenantUser(user));

  useEffect(() => {
    function handlePoliciesAccepted(event: Event) {
      const detail = (event as CustomEvent<{ policyVersion?: string }>).detail;
      if (detail?.policyVersion === POLICY_VERSION) {
        setAccepted(true);
      }
    }

    window.addEventListener("constriqo:policies-accepted", handlePoliciesAccepted);
    setNativeInfo(getNativeRuntimeInfo());
    setNotificationConsent(getNotificationConsentStatus());
    void refresh();

    return () => {
      window.removeEventListener("constriqo:policies-accepted", handlePoliciesAccepted);
    };
  }, []);

  async function refresh() {
    setLoading(true);
    setMessage(null);
    try {
      const [nextSettings, acceptances, preferences, usage] = await Promise.all([
        getTenantSettings(session.sessionToken),
        listPolicyAcceptances(session.sessionToken),
        getPrivacyPreferences(session.sessionToken),
        getTenantUsage(session.sessionToken),
      ]);
      const nextUsers = session.user.capabilities.includes("organization.users.manage")
        ? await listTenantUsers(session.sessionToken)
        : [];
      setSettings(nextSettings);
      setUsers(nextUsers);
      setPrivacyPreferences(preferences);
      setTenantUsage(usage);
      setAccepted(acceptances.some((item) => item.policyVersion === POLICY_VERSION && item.status === "accepted"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar configuracion.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setTemporaryAccess(null);
    try {
      const result = await createTenantUser(session.sessionToken, {
        ...userForm,
        password: userForm.password || undefined,
      });
      setUserForm(initialUserForm);
      setTemporaryAccess({ email: result.user.email, password: result.temporaryPassword });
      setUsers(await listTenantUsers(session.sessionToken));
      setUserFormOpen(false);
      setMessage("Usuario creado con rol y clave temporal.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el usuario.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUserUpdate(userId: string, input: Partial<{ status: TenantUserStatus; role: TenantUserRole }>) {
    setSaving(true);
    setMessage(null);
    try {
      await updateTenantUser(session.sessionToken, userId, input);
      setUsers(await listTenantUsers(session.sessionToken));
      setMessage("Usuario actualizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el usuario.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordReset(user: TenantUser) {
    setSaving(true);
    setMessage(null);
    setTemporaryAccess(null);
    try {
      const result = await resetTenantUserPassword(session.sessionToken, user.userId);
      setTemporaryAccess({ email: result.user.email, password: result.temporaryPassword });
      setMessage("Clave temporal regenerada y sesiones revocadas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo resetear la clave.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const nextSettings = await updateTenantSettings(session.sessionToken, settings);
      setSettings(nextSettings);
      window.dispatchEvent(new CustomEvent("constriqo:tenant-settings-updated", { detail: nextSettings }));
      setSettingsFormOpen(false);
      setMessage("Configuracion guardada con auditoria.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar configuracion.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAcceptPolicies() {
    if (!settings) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await acceptRequiredPolicies(session.sessionToken, {
        policyVersion: POLICY_VERSION,
        language: settings.appLanguage,
      });
      setAccepted(true);
      setMessage("Aceptacion de politicas registrada con evidencia.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar aceptacion.");
    } finally {
      setSaving(false);
    }
  }

  function applyCountryDefaults(country: TenantSettings["countryProfile"]) {
    if (!settings) {
      return;
    }
    setSettings({
      ...settings,
      countryProfile: country,
      ...countryDefaults[country],
    });
  }

  function handleLogoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !settings) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setMessage("El logo debe ser una imagen.");
      return;
    }
    if (file.size > 750_000) {
      setMessage("El logo es demasiado pesado. Usa una imagen menor a 750 KB para mantener la app ligera.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSettings({ ...settings, logoUrl: String(reader.result || "") });
      setMessage("Logo cargado localmente. Guarda ajustes para aplicarlo en documentos.");
    };
    reader.onerror = () => setMessage("No se pudo leer el logo seleccionado.");
    reader.readAsDataURL(file);
  }

  async function handleNotificationConsent() {
    setSaving(true);
    setMessage(null);
    try {
      const nextStatus = await requestNotificationConsent(true);
      setNotificationConsent(nextStatus);
      setMessage(nextStatus === "granted" ? "Permiso de notificaciones concedido en este dispositivo." : "Permiso de notificaciones no concedido.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo revisar el permiso de notificaciones.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePrivacyPreferenceChange(input: Partial<PrivacyPreferences>) {
    if (!settings || !privacyPreferences) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const nextPreferences = await updatePrivacyPreferences(session.sessionToken, {
        ...privacyPreferences,
        ...input,
        policyVersion: PRIVACY_POLICY_VERSION,
        language: settings.appLanguage,
      });
      setPrivacyPreferences(nextPreferences);
      setMessage("Preferencias de privacidad guardadas con auditoria.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron guardar preferencias de privacidad.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="production-module-content">
      <PageHeader
        eyebrow="Configuracion SaaS"
        title="Empresa, pais y cumplimiento"
        description="Ajustes reales por tenant para moneda, unidades, idioma, dominio privado y aceptacion de politicas."
        actions={
          <div className="segmented-actions">
            {settings ? (
              <Button variant="primary" type="button" icon={<Save size={16} />} onClick={() => setSettingsFormOpen(true)}>
                Editar empresa
              </Button>
            ) : null}
            {session.user.capabilities.includes("organization.users.manage") ? (
              <Button variant="secondary" type="button" icon={<Users size={16} />} onClick={() => setUserFormOpen(true)}>
                Crear usuario
              </Button>
            ) : null}
            <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>
              Actualizar
            </Button>
          </div>
        }
      />

      {message ? <p className="login-notice">{message}</p> : null}
      {temporaryAccess ? (
        <section className="login-notice">
          <strong>Clave temporal:</strong> {temporaryAccess.email} · <strong>{temporaryAccess.password}</strong>
        </section>
      ) : null}

      {!settings ? (
        <p className="login-security-note">{loading ? "Cargando configuracion..." : "No hay configuracion disponible."}</p>
      ) : (
        <section className="grid two-column crm-real-grid">
          <aside className="card">
            <div className="card-title-row">
              <h2 className="card-title">Datos base del tenant</h2>
              <StatusBadge label={settings.countryProfile} tone="info" />
            </div>
            <div className="activity-list">
              <article className="activity-item">
                <span className="activity-icon"><Globe2 size={18} /></span>
                <div>
                  <p className="activity-title">{settings.companyName}</p>
                  <p className="activity-meta">{settings.currency} · {settings.unitSystem} · app {settings.appLanguage} · documentos {settings.documentLanguage}</p>
                </div>
              </article>
              <article className="activity-item">
                <span className="activity-icon"><FileText size={18} /></span>
                <div>
                  <p className="activity-title">{settings.legalName || "Razon social pendiente"}</p>
                  <p className="activity-meta">{settings.taxId || "Identificacion fiscal pendiente"} · {settings.companyEmail || "correo pendiente"}</p>
                </div>
              </article>
            </div>
            <Button variant="primary" type="button" icon={<Save size={16} />} onClick={() => setSettingsFormOpen(true)}>
              Editar datos de empresa
            </Button>
          </aside>

          <BasicModal title="Editar empresa, pais y documentos" open={settingsFormOpen} onClose={() => setSettingsFormOpen(false)} size="wide" footer={null}>
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="card-title-row">
              <h2 className="card-title">Datos base del tenant</h2>
              <StatusBadge label={settings.countryProfile} tone="info" />
            </div>
            <label className="form-control">
              <span>Nombre de empresa</span>
              <input className="input" value={settings.companyName} onChange={(event) => setSettings({ ...settings, companyName: event.target.value })} required />
            </label>
            <div className="grid proof-grid">
              <label className="form-control">
                <span>Pais / mercado</span>
                <select className="select" value={settings.countryProfile} onChange={(event) => applyCountryDefaults(event.target.value as TenantSettings["countryProfile"])}>
                  <option value="US">Estados Unidos</option>
                  <option value="CO">Colombia</option>
                  <option value="ES">Espana</option>
                </select>
              </label>
              <label className="form-control">
                <span>Moneda</span>
                <select className="select" value={settings.currency} onChange={(event) => setSettings({ ...settings, currency: event.target.value as TenantSettings["currency"] })}>
                  <option value="USD">USD</option>
                  <option value="COP">COP</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
              <label className="form-control">
                <span>Unidades</span>
                <select className="select" value={settings.unitSystem} onChange={(event) => setSettings({ ...settings, unitSystem: event.target.value as TenantSettings["unitSystem"] })}>
                  <option value="imperial">Imperial / US customary</option>
                  <option value="metric">Metrico</option>
                </select>
              </label>
              <label className="form-control">
                <span>Subdominio privado</span>
                <input className="input" placeholder="cliente.Constriqo.com" value={settings.tenantSlug} onChange={(event) => setSettings({ ...settings, tenantSlug: event.target.value })} />
              </label>
              <label className="form-control">
                <span>Idioma app</span>
                <select className="select" value={settings.appLanguage} onChange={(event) => setSettings({ ...settings, appLanguage: event.target.value as TenantSettings["appLanguage"] })}>
                  <option value="es">Espanol</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="form-control">
                <span>Idioma documentos</span>
                <select className="select" value={settings.documentLanguage} onChange={(event) => setSettings({ ...settings, documentLanguage: event.target.value as TenantSettings["documentLanguage"] })}>
                  <option value="es">Espanol</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
            <div className="crm-detail-panel">
              <div className="card-title-row">
                <h3 className="alert-title">Datos para facturas y cotizaciones</h3>
                <StatusBadge label="Solo administracion" tone="warning" />
              </div>
              <div className="grid proof-grid">
                <label className="form-control">
                  <span>Logo desde archivo</span>
                  <input className="input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoFile} />
                  <small className="activity-meta">Tambien puedes pegar una URL si ya tienes el logo alojado.</small>
                  <input
                    className="input"
                    placeholder="https://..."
                    value={settings.logoUrl.startsWith("data:") ? "Logo local cargado" : settings.logoUrl}
                    onChange={(event) => setSettings({ ...settings, logoUrl: event.target.value })}
                    readOnly={settings.logoUrl.startsWith("data:")}
                  />
                </label>
                <label className="form-control">
                  <span>Razon social</span>
                  <input className="input" value={settings.legalName} onChange={(event) => setSettings({ ...settings, legalName: event.target.value })} />
                </label>
                <label className="form-control">
                  <span>NIT / NIF / EIN</span>
                  <input className="input" value={settings.taxId} onChange={(event) => setSettings({ ...settings, taxId: event.target.value })} />
                </label>
                <label className="form-control">
                  <span>Licencia contratista</span>
                  <input className="input" value={settings.contractorLicense} onChange={(event) => setSettings({ ...settings, contractorLicense: event.target.value })} />
                </label>
                <label className="form-control">
                  <span>Direccion fiscal/comercial</span>
                  <input className="input" value={settings.companyAddress} onChange={(event) => setSettings({ ...settings, companyAddress: event.target.value })} />
                </label>
                <label className="form-control">
                  <span>Ciudad</span>
                  <input className="input" value={settings.companyCity} onChange={(event) => setSettings({ ...settings, companyCity: event.target.value })} />
                </label>
                <label className="form-control">
                  <span>Region / Estado</span>
                  <input className="input" value={settings.companyRegion} onChange={(event) => setSettings({ ...settings, companyRegion: event.target.value })} />
                </label>
                <label className="form-control">
                  <span>Codigo postal</span>
                  <input className="input" value={settings.companyPostalCode} onChange={(event) => setSettings({ ...settings, companyPostalCode: event.target.value })} />
                </label>
                <label className="form-control">
                  <span>Telefono empresa</span>
                  <input className="input" value={settings.companyPhone} onChange={(event) => setSettings({ ...settings, companyPhone: event.target.value })} />
                </label>
                <label className="form-control">
                  <span>Telefono para trabajadores</span>
                  <input className="input" value={settings.workerSupportPhone} onChange={(event) => setSettings({ ...settings, workerSupportPhone: event.target.value })} />
                  <small className="activity-meta">Se usa para el boton llamar desde el perfil trabajador. Si queda vacio se usa el telefono de empresa.</small>
                </label>
                <label className="form-control">
                  <span>WhatsApp trabajadores</span>
                  <input
                    className="input"
                    placeholder="https://wa.me/15551234567 o enlace de grupo"
                    value={settings.workerSupportWhatsappUrl}
                    onChange={(event) => setSettings({ ...settings, workerSupportWhatsappUrl: event.target.value })}
                  />
                  <small className="activity-meta">Solo abre WhatsApp; no usa API ni envia mensajes automaticos.</small>
                </label>
                <label className="form-control">
                  <span>Correo empresa</span>
                  <input className="input" value={settings.companyEmail} onChange={(event) => setSettings({ ...settings, companyEmail: event.target.value })} />
                </label>
                <label className="form-control">
                  <span>Web</span>
                  <input className="input" value={settings.companyWebsite} onChange={(event) => setSettings({ ...settings, companyWebsite: event.target.value })} />
                </label>
                <label className="form-control">
                  <span>Firma representante</span>
                  <input
                    className="input"
                    value={settings.documentSignature.name}
                    onChange={(event) => setSettings({ ...settings, documentSignature: { ...settings.documentSignature, name: event.target.value } })}
                  />
                </label>
              </div>
            </div>
            <div className="crm-detail-panel">
              <div className="card-title-row">
                <h3 className="alert-title">Plantillas activas</h3>
                <StatusBadge label="Miniaturas" tone="info" />
              </div>
              <div className="grid proof-grid">
                <label className="form-control">
                  <span>Plantilla de cotizacion</span>
                  <select className="select" value={settings.estimateTemplateId} onChange={(event) => setSettings({ ...settings, estimateTemplateId: event.target.value as TenantSettings["estimateTemplateId"] })}>
                    <option value="estimate_classic_blue">Clasica azul construccion</option>
                    <option value="estimate_cleaning_teal">Limpieza teal</option>
                  </select>
                </label>
                <label className="form-control">
                  <span>Plantilla de factura</span>
                  <select className="select" value={settings.invoiceTemplateId} onChange={(event) => setSettings({ ...settings, invoiceTemplateId: event.target.value as TenantSettings["invoiceTemplateId"] })}>
                    <option value="invoice_clean_red">Factura rojo/naranja</option>
                    <option value="invoice_compact_navy">Factura compacta azul</option>
                  </select>
                </label>
              </div>
              <div className="document-template-preview-grid">
                <DocumentTemplatePreview title="Cotizacion azul" active={settings.estimateTemplateId === "estimate_classic_blue"} tone="blue" />
                <DocumentTemplatePreview title="Cotizacion teal" active={settings.estimateTemplateId === "estimate_cleaning_teal"} tone="teal" />
                <DocumentTemplatePreview title="Factura rojo" active={settings.invoiceTemplateId === "invoice_clean_red"} tone="red" />
                <DocumentTemplatePreview title="Factura azul" active={settings.invoiceTemplateId === "invoice_compact_navy"} tone="navy" />
              </div>
            </div>
            <div className="crm-detail-panel">
              <div className="card-title-row">
                <h3 className="alert-title">Mostrar en documentos</h3>
                <StatusBadge label="Visible/oculto" tone="info" />
              </div>
              <div className="document-field-toggle-grid">
                {Object.entries(settings.documentCompanyVisibility).map(([key, value]) => (
                  <label className="checkbox-row" key={key}>
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          documentCompanyVisibility: { ...settings.documentCompanyVisibility, [key]: event.target.checked },
                        })
                      }
                    />
                    <span>{companyVisibilityLabel(key)}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button variant="primary" type="submit" icon={<Save size={16} />} disabled={saving}>
              Guardar ajustes
            </Button>
          </form>
          </BasicModal>

          {session.user.capabilities.includes("organization.users.manage") ? (
            <aside className="card">
              <div className="card-title-row">
                <h2 className="card-title">Usuarios activos</h2>
                <div className="segmented-actions">
                  <StatusBadge label={`${managedUsers.length} registros`} tone="info" />
                  <Button variant="secondary" type="button" icon={<Users size={16} />} onClick={() => setUserFormOpen(true)}>
                    Crear
                  </Button>
                </div>
              </div>
              <div className="responsive-table">
                {managedUsers.length > 0 ? managedUsers.map((user) => (
                  <article className="table-row users-table-grid" key={user.userId}>
                    <div>
                      <strong>{user.displayName}</strong>
                      <span className="activity-meta">{user.email}</span>
                    </div>
                    <select className="select" value={user.roles[0] || "worker"} onChange={(event) => void handleUserUpdate(user.userId, { role: event.target.value as TenantUserRole })} disabled={saving}>
                      <option value="manager">Manager</option>
                      <option value="worker">Trabajador</option>
                    </select>
                    <select className="select" value={user.status} onChange={(event) => void handleUserUpdate(user.userId, { status: event.target.value as TenantUserStatus })} disabled={saving}>
                      <option value="active">Activo</option>
                      <option value="inactive">Inactivo</option>
                      <option value="suspended">Suspendido</option>
                    </select>
                    <Button variant="secondary" type="button" icon={<KeyRound size={16} />} onClick={() => void handlePasswordReset(user)} disabled={saving}>
                      Reset
                    </Button>
                  </article>
                )) : (
                  <div className="empty-state">
                    <Users size={24} />
                    <h3>Sin personal gestionable</h3>
                    <p>Crea gerentes o trabajadores para administrar accesos operativos. La cuenta propietaria se gestiona en Datos de seguridad.</p>
                  </div>
                )}
              </div>
            </aside>
          ) : null}

          <aside className="card">
            <div className="card-title-row">
              <h2 className="card-title">Datos de seguridad</h2>
              <StatusBadge label="Cuenta propietaria" tone="info" />
            </div>
            <div className="activity-list">
              <article className="activity-item">
                <span className="activity-icon"><ShieldCheck size={18} /></span>
                <div>
                  <p className="activity-title">{session.user.displayName}</p>
                  <p className="activity-meta">{session.user.email}</p>
                </div>
              </article>
              <article className="activity-item">
                <span className="activity-icon"><KeyRound size={18} /></span>
                <div>
                  <p className="activity-title">Contraseña y segundo factor</p>
                  <p className="activity-meta">La cuenta administradora no aparece como usuario operativo. Sus cambios de seguridad se gestionan desde este apartado para no mezclarla con gerentes o trabajadores.</p>
                </div>
              </article>
            </div>
          </aside>

          <aside className="card">
            <div className="card-title-row">
              <h2 className="card-title">Privacidad y terminos</h2>
              <StatusBadge label={accepted ? "Aceptado" : "Pendiente"} tone={accepted ? "success" : "warning"} />
            </div>
            <div className="activity-list">
              <article className="activity-item">
                <span className="activity-icon"><ShieldCheck size={18} /></span>
                <div>
                  <p className="activity-title">Tratamiento de datos</p>
                  <p className="activity-meta">Uso para operar el SaaS, separar tenants, auditoria, seguridad, soporte y obligaciones legales.</p>
                </div>
              </article>
              <article className="activity-item">
                <span className="activity-icon"><Globe2 size={18} /></span>
                <div>
                  <p className="activity-title">Cookies y medicion</p>
                  <p className="activity-meta">Tecnicas por defecto; analiticas o marketing solo con consentimiento granular futuro.</p>
                </div>
              </article>
              <article className="activity-item">
                <span className="activity-icon"><CheckCircle2 size={18} /></span>
                <div>
                  <p className="activity-title">No uso indebido</p>
                  <p className="activity-meta">No venta de datos, no mezcla entre clientes y no entrenamiento IA sin contrato/consentimiento.</p>
                </div>
              </article>
            </div>
            <Button variant="secondary" type="button" icon={<ShieldCheck size={16} />} onClick={() => void handleAcceptPolicies()} disabled={saving || accepted} fullWidth>
              Registrar aceptacion
            </Button>
          </aside>

          <aside className="card">
            <div className="card-title-row">
              <h2 className="card-title">Cookies y comunicaciones</h2>
              <StatusBadge label="No esenciales apagadas" tone="warning" />
            </div>
            <div className="activity-list">
              <label className="checkbox-row">
                <input type="checkbox" checked readOnly />
                <span>Cookies tecnicas necesarias para sesion, seguridad, idioma y funcionamiento.</span>
              </label>
              <PreferenceToggle
                label="Permitir analitica interna futura"
                checked={Boolean(privacyPreferences?.analyticsCookies)}
                disabled={saving || !privacyPreferences}
                onChange={(checked) => void handlePrivacyPreferenceChange({ analyticsCookies: checked })}
              />
              <PreferenceToggle
                label="Permitir cookies de marketing futuras"
                checked={Boolean(privacyPreferences?.marketingCookies)}
                disabled={saving || !privacyPreferences}
                onChange={(checked) => void handlePrivacyPreferenceChange({ marketingCookies: checked })}
              />
              <PreferenceToggle
                label="Permitir comunicaciones por correo"
                checked={Boolean(privacyPreferences?.emailCommunications)}
                disabled={saving || !privacyPreferences}
                onChange={(checked) => void handlePrivacyPreferenceChange({ emailCommunications: checked })}
              />
              <PreferenceToggle
                label="Permitir SMS futuros"
                checked={Boolean(privacyPreferences?.smsCommunications)}
                disabled={saving || !privacyPreferences}
                onChange={(checked) => void handlePrivacyPreferenceChange({ smsCommunications: checked })}
              />
              <PreferenceToggle
                label="Permitir push cuando Android/PWA este aprobado"
                checked={Boolean(privacyPreferences?.pushNotifications)}
                disabled={saving || !privacyPreferences}
                onChange={(checked) => void handlePrivacyPreferenceChange({ pushNotifications: checked })}
              />
            </div>
            <p className="activity-meta">
              Puedes rechazar o cambiar preferencias no esenciales sin perder acceso. No se activan rastreos ni marketing externo en esta fase.
            </p>
          </aside>

          <aside className="card">
            <div className="card-title-row">
              <h2 className="card-title">PWA y Android</h2>
              <StatusBadge label={nativeInfo?.runtime === "android-wrapper-ready" ? "Wrapper" : "Web/PWA"} tone="info" />
            </div>
            <div className="activity-list">
              <article className="activity-item">
                <span className="activity-icon"><Smartphone size={18} /></span>
                <div>
                  <p className="activity-title">Runtime</p>
                  <p className="activity-meta">{nativeInfo ? `${nativeInfo.runtime} · ubicacion ${nativeInfo.location}` : "Detectando capacidades..."}</p>
                </div>
              </article>
              <article className="activity-item">
                <span className="activity-icon"><Bell size={18} /></span>
                <div>
                  <p className="activity-title">Notificaciones</p>
                  <p className="activity-meta">Estado del dispositivo: {notificationConsentLabel(notificationConsent)}. Push real queda bloqueado hasta consentimiento y QA.</p>
                </div>
              </article>
              <article className="activity-item">
                <span className="activity-icon"><HardDrive size={18} /></span>
                <div>
                  <p className="activity-title">Documentos y sincronizacion</p>
                  <p className="activity-meta">{nativeInfo ? `${nativeInfo.files} · ${nativeInfo.syncQueue}` : "Preparado sin escrituras offline."}</p>
                </div>
              </article>
            </div>
            <Button
              variant="secondary"
              type="button"
              icon={<Bell size={16} />}
              onClick={() => void handleNotificationConsent()}
              disabled={saving || notificationConsent === "unsupported" || notificationConsent === "granted"}
              fullWidth
            >
              Revisar permiso de notificaciones
            </Button>
          </aside>

          <aside className="card">
            <div className="card-title-row">
              <h2 className="card-title">Plan y cuotas</h2>
              <StatusBadge label={tenantUsage ? usageStatusLabel(tenantUsage.status) : "Cargando"} tone={usageTone(tenantUsage?.status)} />
            </div>
            {tenantUsage ? (
              <div className="activity-list">
                <article className="activity-item">
                  <span className="activity-icon"><HardDrive size={18} /></span>
                  <div>
                    <p className="activity-title">Almacenamiento usado</p>
                    <p className="activity-meta">
                      {formatMb(tenantUsage.storageUsedBytes)} MB de {tenantUsage.storageQuotaMb} MB · {tenantUsage.storageUsagePercent}%
                    </p>
                    <div className="usage-meter" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, tenantUsage.storageUsagePercent)}%` }} />
                    </div>
                  </div>
                </article>
                <article className="activity-item">
                  <span className="activity-icon"><ShieldCheck size={18} /></span>
                  <div>
                    <p className="activity-title">Documentos y archivos pesados</p>
                    <p className="activity-meta">
                      {tenantUsage.documentCount} de {tenantUsage.documentQuota} documentos · {tenantUsage.heavyFileReferences} archivos activos · {tenantUsage.cleanedHeavyFiles} archivados
                    </p>
                  </div>
                </article>
                <div className="grid proof-grid">
                  <ReadOnlyMetric label="Plan comercial" value={planLabel(tenantUsage.planCode)} />
                  <ReadOnlyMetric label="Cuota MB" value={`${tenantUsage.storageQuotaMb} MB`} />
                  <ReadOnlyMetric label="Cuota documentos" value={`${tenantUsage.documentQuota}`} />
                </div>
                <div className="activity-item">
                  <span className="activity-icon"><ShieldCheck size={18} /></span>
                  <div>
                    <p className="activity-title">Modulos incluidos</p>
                    <p className="activity-meta">{enabledAddonsLabel(tenantUsage)}</p>
                  </div>
                </div>
                <p className="activity-meta">
                  El plan, cuotas y add-ons son administrados por el proveedor desde Super Admin. El cliente solo ve consumo, limites y alertas de limpieza.
                </p>
              </div>
            ) : (
              <p className="activity-meta">Cargando consumo y limites del tenant.</p>
            )}
          </aside>
        </section>
      )}

      {session.user.capabilities.includes("organization.users.manage") ? (
        <BasicModal title="Crear usuario y rol" open={userFormOpen} onClose={() => setUserFormOpen(false)} footer={null}>
          <form className="auth-form" onSubmit={handleCreateUser}>
            <div className="card-title-row">
              <h2 className="card-title">Usuarios y roles</h2>
              <StatusBadge label="Admin" tone="info" />
            </div>
            <label className="form-control">
              <span>Nombre</span>
              <input className="input" value={userForm.displayName} onChange={(event) => setUserForm({ ...userForm, displayName: event.target.value })} required />
            </label>
            <label className="form-control">
              <span>Correo</span>
              <input className="input" type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} required />
            </label>
            <div className="grid proof-grid">
              <label className="form-control">
                <span>Rol</span>
                <select className="select" value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value as ManagedTenantUserRole })}>
                  <option value="manager">Manager</option>
                  <option value="worker">Trabajador</option>
                </select>
              </label>
              <label className="form-control">
                <span>Clave temporal opcional</span>
                <input className="input" type="password" minLength={14} value={userForm.password || ""} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} />
              </label>
            </div>
            <Button variant="primary" type="submit" icon={<Users size={16} />} disabled={saving}>
              Crear usuario
            </Button>
          </form>
        </BasicModal>
      ) : null}

      <section className="card settings-session-card">
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Sesion</h2>
            <p className="activity-meta">Usuario actual: {session.user.displayName} · {session.user.email}</p>
          </div>
          <StatusBadge label={session.user.roles.join(", ") || "usuario"} tone="info" />
        </div>
        {!confirmLogout ? (
          <Button variant="secondary" type="button" icon={<LogOut size={16} />} onClick={() => setConfirmLogout(true)} disabled={busy || saving}>
            Cerrar sesion
          </Button>
        ) : (
          <div className="logout-confirm-panel">
            <div>
              <p className="activity-title">Estas seguro de cerrar sesion?</p>
              <p className="activity-meta">Se cerrara esta sesion y tendras que volver a iniciar con tus credenciales.</p>
            </div>
            <div className="crm-client-actions">
              <Button variant="secondary" type="button" onClick={() => setConfirmLogout(false)} disabled={busy}>
                Cancelar
              </Button>
              <Button variant="danger" type="button" icon={<LogOut size={16} />} onClick={onLogout} disabled={busy}>
                Confirmar cierre
              </Button>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

function DocumentTemplatePreview({ title, active, tone }: { title: string; active: boolean; tone: "blue" | "teal" | "red" | "navy" }) {
  return (
    <article className={`document-template-preview ${tone} ${active ? "active" : ""}`}>
      <div className="template-preview-header" />
      <strong>{title}</strong>
      <span />
      <span />
      <span />
      <StatusBadge label={active ? "Activa" : "Disponible"} tone={active ? "success" : "neutral"} />
    </article>
  );
}

function PreferenceToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="checkbox-row">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function ReadOnlyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="form-control">
      <span>{label}</span>
      <strong className="readonly-metric-value">{value}</strong>
    </div>
  );
}

function isManagedTenantUser(user: TenantUser) {
  return !user.roles.includes("admin") && !user.roles.includes("super_admin");
}

function companyVisibilityLabel(key: string) {
  return {
    logo: "Logo",
    commercialName: "Nombre comercial",
    legalName: "Razon social",
    taxId: "NIT/NIF/EIN",
    license: "Licencia",
    address: "Direccion",
    phone: "Telefono",
    email: "Correo",
    website: "Web",
  }[key] || key;
}

function notificationConsentLabel(status: NotificationConsentStatus) {
  return {
    unsupported: "No disponible",
    "not-requested": "No solicitado",
    granted: "Concedido",
    denied: "Denegado",
  }[status];
}

function usageTone(status?: TenantUsage["status"]): "neutral" | "info" | "warning" | "success" | "danger" {
  if (status === "blocked" || status === "danger") {
    return "danger";
  }
  if (status === "warning") {
    return "warning";
  }
  if (status === "ok") {
    return "success";
  }
  return "neutral";
}

function usageStatusLabel(status: TenantUsage["status"]) {
  return {
    ok: "Correcto",
    warning: "Atencion",
    danger: "Alto uso",
    blocked: "Limite",
  }[status];
}

function planLabel(planCode: TenantUsage["planCode"]) {
  return {
    starter: "Starter",
    growth: "Growth",
    dedicated: "Dedicated",
  }[planCode];
}

function enabledAddonsLabel(usage: TenantUsage) {
  const addons = [
    usage.photoEvidenceEnabled ? "Evidencias fotograficas" : "",
    usage.marketingAddonEnabled ? "Marketing" : "",
    usage.dedicatedStorageEnabled ? "Almacenamiento dedicado futuro" : "",
  ].filter(Boolean);
  return addons.length > 0 ? addons.join(" · ") : "Sin add-ons comerciales activos";
}

function formatMb(bytes: number) {
  const value = bytes / 1024 / 1024;
  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}
