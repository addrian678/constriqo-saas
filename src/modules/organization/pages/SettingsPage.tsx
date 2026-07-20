import { useState } from "react";
import { Building2, Cog, Globe2, Languages, LockKeyhole, ToggleLeft } from "lucide-react";
import { appConfig } from "../../../app/config/appConfig";
import { BasicModal } from "../../../shared/components/BasicModal";
import { Button } from "../../../shared/components/Button";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { companySettings, moduleToggles, type CompanySetting } from "../mock-data/organizationData";

const settingTone: Record<CompanySetting["status"], "neutral" | "info" | "warning" | "success" | "danger"> = {
  Activo: "success",
  Preparado: "info",
  "Bloqueado en V0": "warning",
};

export function SettingsPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="Administrador - V0.14"
        title="Configuracion"
        description="Perfil de empresa, localizacion, modulos, perfiles sectoriales y seguridad visual. Sin guardado productivo."
        actions={
          <Button variant="secondary" icon={<Cog size={18} />} onClick={() => setModalOpen(true)}>
            Editar visual
          </Button>
        }
      />

      <section className="grid stats-grid">
        <StatCard label="Empresa" value={appConfig.companyName} note="Tenant visual" tone="info" icon={Building2} />
        <StatCard label="Moneda" value={appConfig.currency} note="Sin FX real" tone="positive" icon={Globe2} />
        <StatCard label="Idiomas" value={String(appConfig.locale.documentLanguages.length)} note="ES/EN preparados" tone="warning" icon={Languages} />
        <StatCard label="Modulos" value={String(appConfig.enabledModules.length)} note="Activos visuales" tone="danger" icon={ToggleLeft} />
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Ajustes de empresa</h2>
              <p className="activity-meta">Valores leidos desde configuracion y mock data; no se persisten cambios.</p>
            </div>
            <StatusBadge label="V0.14 visual" tone="info" />
          </div>
          <div className="responsive-table">
            <div className="table-header settings-table-grid">
              <span>Ajuste</span>
              <span>Grupo</span>
              <span>Valor</span>
              <span>Estado</span>
            </div>
            {companySettings.map((setting) => (
              <article className="table-row settings-table-grid" key={setting.settingId}>
                <strong>{setting.label}</strong>
                <span>{setting.group}</span>
                <span>{setting.value}</span>
                <StatusBadge label={setting.status} tone={settingTone[setting.status]} />
              </article>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Seguridad preparada</h2>
            <LockKeyhole size={20} />
          </div>
          <div className="grid proof-grid">
            <VisualField label="Registro publico" value="No permitido" />
            <VisualField label="Invitaciones" value="F1 con token temporal" />
            <VisualField label="Permisos" value="Servidor en F1" />
            <VisualField label="Auditoria" value="Inmutable en F1" />
            <VisualField label="Tenant" value="Aislamiento pendiente" />
            <VisualField label="Secretos" value="Solo por entorno futuro" />
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Modulos habilitados</h2>
            <p className="activity-meta">Interruptores visuales para validar configuracion modular. No alteran rutas en tiempo real.</p>
          </div>
          <StatusBadge label={appConfig.activeIndustryProfile} tone="success" />
        </div>
        <div className="grid status-grid">
          {moduleToggles.map((module) => (
            <article className="alert-card" key={module.moduleId}>
              <div className="alert-heading">
                <h3 className="alert-title">{module.label}</h3>
                <StatusBadge label={module.status} tone="success" />
              </div>
              <p className="alert-text">Feature flag visual lista para migrar a configuracion real en F1.</p>
            </article>
          ))}
        </div>
      </section>

      <BasicModal title="Configuracion visual" open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="grid">
          <p className="activity-meta">
            La edicion queda simulada. En fases funcionales se validaran entradas, permisos, auditoria y aislamiento por empresa.
          </p>
          <label className="form-control">
            <span className="visual-field-label">Empresa</span>
            <input className="input" value={appConfig.companyName} readOnly />
          </label>
          <label className="form-control">
            <span className="visual-field-label">Perfil activo</span>
            <select className="select" value={appConfig.activeIndustryProfile} disabled>
              <option value="construction">construction</option>
            </select>
          </label>
        </div>
      </BasicModal>
    </>
  );
}
