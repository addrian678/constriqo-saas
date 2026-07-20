import { BarChart3, Bell, BriefcaseBusiness, Building2, Clock3, FileArchive, FileText, Home, Landmark, LockKeyhole, Megaphone, Menu, Receipt, Settings, Tags, UserCheck, Users, X, type LucideIcon } from "lucide-react";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import type { AuthenticatedSession } from "./auth/authClient";
import { refreshTenantWorkspaceCache, warmTenantWorkspaceCache } from "./cache/workspaceCache";
import { Button } from "../shared/components/Button";
import { ToastViewport } from "../shared/components/ToastViewport";
import { getDocumentCleanupStatus, type DocumentCleanupStatus } from "../modules/documents/api/documentsClient";
import { acceptRequiredPolicies, getTenantSettings, getTenantUsage, listPolicyAcceptances, type TenantSettings, type TenantUsage } from "../modules/organization/api/organizationClient";

const AssetsLiabilitiesRealPage = lazy(() => import("../modules/assets/pages/AssetsLiabilitiesRealPage").then((module) => ({ default: module.AssetsLiabilitiesRealPage })));
const AttendanceRealPage = lazy(() => import("../modules/attendance/pages/AttendanceRealPage").then((module) => ({ default: module.AttendanceRealPage })));
const CrmRealPage = lazy(() => import("../modules/crm/pages/CrmRealPage").then((module) => ({ default: module.CrmRealPage })));
const BusinessOverviewRealPage = lazy(() => import("../modules/dashboard/pages/BusinessOverviewRealPage").then((module) => ({ default: module.BusinessOverviewRealPage })));
const DocumentsRealPage = lazy(() => import("../modules/documents/pages/DocumentsRealPage").then((module) => ({ default: module.DocumentsRealPage })));
const EstimatesRealPage = lazy(() => import("../modules/estimates/pages/EstimatesRealPage").then((module) => ({ default: module.EstimatesRealPage })));
const FinanceRealPage = lazy(() => import("../modules/finance/pages/FinanceRealPage").then((module) => ({ default: module.FinanceRealPage })));
const InvoicingRealPage = lazy(() => import("../modules/invoicing/pages/InvoicingRealPage").then((module) => ({ default: module.InvoicingRealPage })));
const JobsRealPage = lazy(() => import("../modules/jobs/pages/JobsRealPage").then((module) => ({ default: module.JobsRealPage })));
const MarketingRealPage = lazy(() => import("../modules/marketing/pages/MarketingRealPage").then((module) => ({ default: module.MarketingRealPage })));
const NotificationsAuditRealPage = lazy(() => import("../modules/notifications/pages/NotificationsAuditRealPage").then((module) => ({ default: module.NotificationsAuditRealPage })));
const TenantSettingsRealPage = lazy(() => import("../modules/organization/pages/TenantSettingsRealPage").then((module) => ({ default: module.TenantSettingsRealPage })));
const ReportsRealPage = lazy(() => import("../modules/reports/pages/ReportsRealPage").then((module) => ({ default: module.ReportsRealPage })));
const ServiceCatalogRealPage = lazy(() => import("../modules/services/pages/ServiceCatalogRealPage").then((module) => ({ default: module.ServiceCatalogRealPage })));
const WorkforceRealPage = lazy(() => import("../modules/workforce/pages/WorkforceRealPage").then((module) => ({ default: module.WorkforceRealPage })));

type ProductionWorkspaceProps = {
  session: AuthenticatedSession;
  busy?: boolean;
  onLogout: () => void;
};

type WorkspaceModule = "home" | "crm" | "marketing" | "services" | "estimates" | "invoicing" | "jobs" | "workforce" | "attendance" | "finance" | "assets" | "documents" | "reports" | "notifications" | "settings";

const modules: Array<{ id: WorkspaceModule; label: string; icon: LucideIcon; capabilities?: string[] }> = [
  { id: "home", label: "Inicio", icon: Home, capabilities: ["reports.read", "finance.read", "clients.read"] },
  { id: "crm", label: "Clientes", icon: Users, capabilities: ["clients.read"] },
  { id: "marketing", label: "Marketing", icon: Megaphone, capabilities: ["marketing.read"] },
  { id: "services", label: "Servicios", icon: Tags, capabilities: ["estimates.read"] },
  { id: "estimates", label: "Cotizaciones", icon: FileText, capabilities: ["estimates.read"] },
  { id: "invoicing", label: "Facturas", icon: Receipt, capabilities: ["invoices.read"] },
  { id: "jobs", label: "Obras", icon: BriefcaseBusiness, capabilities: ["jobs.read"] },
  { id: "workforce", label: "Trabajadores", icon: UserCheck, capabilities: ["workforce.read"] },
  { id: "attendance", label: "Asistencia", icon: Clock3, capabilities: ["attendance.read", "attendance.review.visual"] },
  { id: "finance", label: "Finanzas", icon: Landmark, capabilities: ["finance.read"] },
  { id: "assets", label: "Activos", icon: Building2, capabilities: ["assets.read", "liabilities.read"] },
  { id: "documents", label: "Archivo", icon: FileArchive, capabilities: ["documents.read"] },
  { id: "reports", label: "Reportes", icon: BarChart3, capabilities: ["reports.read"] },
  { id: "notifications", label: "Alertas", icon: Bell, capabilities: ["notifications.read"] },
  { id: "settings", label: "Ajustes", icon: Settings, capabilities: ["organization.read"] },
];

const REQUIRED_POLICY_VERSION = "2026-07-14";

export function ProductionWorkspace({ session, busy, onLogout }: ProductionWorkspaceProps) {
  useMemo(() => warmTenantWorkspaceCache(session), [session]);

  const [activeModule, setActiveModule] = useState<WorkspaceModule>("home");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(null);
  const [tenantUsage, setTenantUsage] = useState<TenantUsage | null>(null);
  const [cleanupStatus, setCleanupStatus] = useState<DocumentCleanupStatus | null>(null);
  const [requiredPoliciesAccepted, setRequiredPoliciesAccepted] = useState(true);

  useEffect(() => {
    let mounted = true;
    function handleSettingsUpdated(event: Event) {
      const nextSettings = (event as CustomEvent<TenantSettings>).detail;
      if (nextSettings?.tenantId === session.tenant.tenantId) {
        setTenantSettings(nextSettings);
      }
    }
    function handleUsageUpdated(event: Event) {
      const nextUsage = (event as CustomEvent<TenantUsage>).detail;
      if (nextUsage?.planCode) {
        setTenantUsage(nextUsage);
      }
    }

    window.addEventListener("constructflow:tenant-settings-updated", handleSettingsUpdated);
    window.addEventListener("constructflow:tenant-usage-updated", handleUsageUpdated);
    getTenantSettings(session.sessionToken)
      .then((settings) => {
        if (mounted) {
          setTenantSettings(settings);
        }
      })
      .catch(() => {
        if (mounted) {
          setTenantSettings(null);
        }
      });
    getTenantUsage(session.sessionToken)
      .then((usage) => {
        if (mounted) {
          setTenantUsage(usage);
        }
      })
      .catch(() => {
        if (mounted) {
          setTenantUsage(null);
        }
      });

    return () => {
      mounted = false;
      window.removeEventListener("constructflow:tenant-settings-updated", handleSettingsUpdated);
      window.removeEventListener("constructflow:tenant-usage-updated", handleUsageUpdated);
    };
  }, [session.sessionToken, session.tenant.tenantId]);

  useEffect(() => {
    function handleDataChanged() {
      refreshTenantWorkspaceCache(session);
    }

    window.addEventListener("constructflow:data-changed", handleDataChanged);
    return () => {
      window.removeEventListener("constructflow:data-changed", handleDataChanged);
    };
  }, [session]);

  useEffect(() => {
    let mounted = true;
    getDocumentCleanupStatus(session.sessionToken)
      .then((status) => {
        if (mounted) {
          setCleanupStatus(status);
        }
      })
      .catch(() => {
        if (mounted) {
          setCleanupStatus(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [activeModule, session.sessionToken]);

  useEffect(() => {
    let mounted = true;
    listPolicyAcceptances(session.sessionToken)
      .then((items) => {
        if (mounted) {
          setRequiredPoliciesAccepted(items.some((item) => item.policyVersion === REQUIRED_POLICY_VERSION && item.status === "accepted"));
        }
      })
      .catch(() => {
        if (mounted) {
          setRequiredPoliciesAccepted(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [activeModule, session.sessionToken]);

  const brandName = tenantSettings?.companyName || session.tenant.companyName || "ConstructFlow";
  const brandLogoUrl = tenantSettings?.logoUrl || "";
  const brandLockup = (
    <div className="brand-lockup">
      {brandLogoUrl ? <img className="brand-logo-image" src={brandLogoUrl} alt="" /> : <span className="brand-mark">{brandInitials(brandName)}</span>}
      <div>
        <p className="brand-name">{brandName}</p>
        <p className="brand-subtitle">Software ConstructFlow</p>
      </div>
    </div>
  );
  const visibleModules = useMemo(() => modules.filter((module) => canAccessModule(session, module)), [session]);

  useEffect(() => {
    if (!visibleModules.some((module) => module.id === activeModule)) {
      setActiveModule(visibleModules[0]?.id || "home");
    }
  }, [activeModule, visibleModules]);

  function selectModule(moduleId: WorkspaceModule) {
    setActiveModule(moduleId);
    setDrawerOpen(false);
  }

  async function acceptPoliciesFromBanner() {
    const language = tenantSettings?.appLanguage || "es";
    await acceptRequiredPolicies(session.sessionToken, {
      policyVersion: REQUIRED_POLICY_VERSION,
      language,
    });
    setRequiredPoliciesAccepted(true);
    window.dispatchEvent(new CustomEvent("constructflow:policies-accepted", { detail: { policyVersion: REQUIRED_POLICY_VERSION } }));
  }

  const navigation = (
    <nav className="production-tabs" aria-label="Modulos reales">
      {visibleModules.map((module) => {
        const Icon = module.icon;
        const locked = module.id === "marketing" && tenantUsage?.marketingAddonEnabled === false;
        return (
          <button className={activeModule === module.id ? "active" : ""} type="button" onClick={() => selectModule(module.id)} key={module.id}>
            <Icon size={16} />
            {module.label}
            {locked ? <LockKeyhole size={13} aria-label="Add-on apagado" /> : null}
          </button>
        );
      })}
    </nav>
  );

  return (
    <main className="app-shell production-shell">
      <div className="production-topbar">
        <button className="icon-button production-drawer-button" type="button" onClick={() => setDrawerOpen(true)} aria-label="Abrir menu">
          <Menu size={20} />
        </button>
        {brandLockup}
        <div className="production-tabs-desktop">{navigation}</div>
      </div>

      {drawerOpen ? <button className="mobile-sidebar-backdrop" type="button" onClick={() => setDrawerOpen(false)} aria-label="Cerrar menu" /> : null}
      <aside className={`production-mobile-drawer ${drawerOpen ? "open" : ""}`} aria-label="Menu movil">
        <div className="production-drawer-header">
          {brandLockup}
          <button className="icon-button" type="button" onClick={() => setDrawerOpen(false)} aria-label="Cerrar menu">
            <X size={18} />
          </button>
        </div>
        {navigation}
      </aside>

      <section className="content">
        {!requiredPoliciesAccepted ? (
          <div className="global-retention-banner warning" role="status">
            <FileText size={18} />
            <span>
              <strong>Privacidad y terminos pendientes</strong>
              <small>Registra aceptacion de politica de privacidad, terminos, tratamiento de datos y cookies tecnicas. Puedes revisar el detalle en Ajustes.</small>
            </span>
            <div className="segmented-actions">
              <Button variant="secondary" type="button" onClick={() => selectModule("settings")}>
                Revisar
              </Button>
              <Button variant="primary" type="button" onClick={() => void acceptPoliciesFromBanner()}>
                Aceptar
              </Button>
            </div>
          </div>
        ) : null}
        {cleanupStatus && cleanupStatus.severity !== "none" ? (
          <button className={`global-retention-banner ${cleanupStatus.severity}`} type="button" onClick={() => selectModule("documents")}>
            <AlertIcon severity={cleanupStatus.severity} />
            <span>
              <strong>{cleanupStatus.severity === "danger" ? "Limpieza urgente de archivos" : "Limpieza recomendada de archivos"}</strong>
              <small>
                Archiva y limpia PDFs/imagenes hasta {formatShortDate(cleanupStatus.cleanupCutoffAt)}. No bloquea el trabajo, pero permanece hasta completar la accion.
              </small>
            </span>
          </button>
        ) : null}
        {tenantUsage?.status === "blocked" ? (
          <button className="global-retention-banner danger" type="button" onClick={() => selectModule("settings")}>
            <LockKeyhole size={18} />
            <span>
              <strong>Limite de almacenamiento alcanzado</strong>
              <small>Se bloquea crear nuevos archivos pesados hasta archivar, limpiar o ampliar la cuota del tenant.</small>
            </span>
          </button>
        ) : null}
        <Suspense fallback={<p className="login-notice">Cargando modulo...</p>}>
          {activeModule === "home" ? <BusinessOverviewRealPage session={session} /> : null}
          {activeModule === "crm" ? <CrmRealPage session={session} onLogout={onLogout} busy={busy} embedded /> : null}
          {activeModule === "marketing" ? (
            tenantUsage?.marketingAddonEnabled === false ? (
              <AddonLockedPanel title="Marketing no activo" description="Este modulo esta disponible como add-on del plan. Un administrador puede activarlo en Ajustes > Plan y cuotas." onOpenSettings={() => selectModule("settings")} />
            ) : (
              <MarketingRealPage session={session} />
            )
          ) : null}
          {activeModule === "services" ? <ServiceCatalogRealPage session={session} /> : null}
          {activeModule === "estimates" ? <EstimatesRealPage session={session} /> : null}
          {activeModule === "invoicing" ? <InvoicingRealPage session={session} /> : null}
          {activeModule === "jobs" ? <JobsRealPage session={session} /> : null}
          {activeModule === "workforce" ? <WorkforceRealPage session={session} /> : null}
          {activeModule === "attendance" ? <AttendanceRealPage session={session} /> : null}
          {activeModule === "finance" ? <FinanceRealPage session={session} /> : null}
          {activeModule === "assets" ? <AssetsLiabilitiesRealPage session={session} /> : null}
          {activeModule === "documents" ? <DocumentsRealPage session={session} /> : null}
          {activeModule === "reports" ? <ReportsRealPage session={session} /> : null}
          {activeModule === "notifications" ? <NotificationsAuditRealPage session={session} /> : null}
          {activeModule === "settings" ? <TenantSettingsRealPage session={session} onLogout={onLogout} busy={busy} /> : null}
        </Suspense>
      </section>
      <ToastViewport />
      <footer className="powered-footer">Software impulsado por ConstructFlow</footer>
    </main>
  );
}

function canAccessModule(session: AuthenticatedSession, module: { capabilities?: string[] }) {
  if (!module.capabilities?.length) {
    return true;
  }
  return module.capabilities.some((capability) => session.user.capabilities.includes(capability));
}

function brandInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
  return initials || "CF";
}

function AlertIcon({ severity }: { severity: "warning" | "danger" }) {
  return severity === "danger" ? <FileArchive size={18} /> : <FileClockIcon />;
}

function FileClockIcon() {
  return <FileArchive size={18} />;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

function AddonLockedPanel({ title, description, onOpenSettings }: { title: string; description: string; onOpenSettings: () => void }) {
  return (
    <section className="card">
      <div className="card-title-row">
        <div>
          <h2 className="card-title">{title}</h2>
          <p className="activity-meta">{description}</p>
        </div>
        <LockKeyhole size={22} />
      </div>
      <Button variant="primary" type="button" onClick={onOpenSettings}>
        Revisar plan
      </Button>
    </section>
  );
}
