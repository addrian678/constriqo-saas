import { AlertTriangle, ClipboardCheck, GitCompareArrows, Layers3, ShieldCheck } from "lucide-react";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import {
  industryProfiles,
  moduleReadiness,
  sectorScenarios,
  terminologyComparisons,
  validationSummary,
  type ReadinessStatus,
  type ValidationRisk,
} from "../mock-data/industryValidationData";

const readinessTone: Record<ReadinessStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  "Compatible visual": "success",
  "Requiere adaptacion": "warning",
  "No activar en V0": "danger",
};

const riskTone: Record<ValidationRisk, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Bajo: "success",
  Medio: "warning",
  Alto: "danger",
};

export function IndustryValidationPage() {
  return (
    <>
      <PageHeader
        eyebrow="Administrador - V0.15"
        title="Validacion sectorial"
        description="Comparacion visual entre Construccion y Aseo para confirmar que la plataforma puede extenderse sin duplicar producto ni activar el perfil futuro."
      />

      <section className="grid stats-grid">
        <StatCard label="Perfiles" value={validationSummary.profiles} note="Construccion + Aseo" tone="info" icon={Layers3} />
        <StatCard label="Compatibles" value={validationSummary.compatible} note="Reutilizables" tone="positive" icon={ShieldCheck} />
        <StatCard label="Adaptaciones" value={validationSummary.adaptations} note="Por perfil" tone="warning" icon={GitCompareArrows} />
        <StatCard label="Bloqueados" value={validationSummary.blocked} note="No activar en V0" tone="danger" icon={AlertTriangle} />
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Perfiles sectoriales</h2>
              <p className="activity-meta">Aseo queda preparado como contrato visual, no como perfil activo.</p>
            </div>
            <StatusBadge label="V0.15 visual" tone="info" />
          </div>
          <div className="grid proof-grid">
            {industryProfiles.map((profile) => (
              <article className="alert-card" key={profile.id}>
                <div className="alert-heading">
                  <h3 className="alert-title">{profile.label}</h3>
                  <StatusBadge label={profile.readyForFutureActivation ? "Preparado" : "Activo"} tone={profile.readyForFutureActivation ? "warning" : "success"} />
                </div>
                <p className="alert-text">
                  {profile.workEntityPlural} - {profile.workerLabel}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Criterios de activacion</h2>
            <ClipboardCheck size={20} />
          </div>
          <div className="grid proof-grid">
            <VisualField label="Perfil activo" value="construction" />
            <VisualField label="Perfil futuro" value="cleaning" />
            <VisualField label="Duplicacion de producto" value="No permitida" />
            <VisualField label="Activacion en V0" value="Bloqueada" />
            <VisualField label="Plantillas por perfil" value="Pendiente" />
            <VisualField label="Permisos por perfil" value="Pendiente F1/F3" />
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Terminologia comparada</h2>
            <p className="activity-meta">Matriz para detectar textos, entidades y formularios que deben parametrizarse.</p>
          </div>
          <StatusBadge label="Contrato visual" tone="neutral" />
        </div>
        <div className="responsive-table">
          <div className="table-header sector-terms-grid">
            <span>Area</span>
            <span>Construccion</span>
            <span>Aseo</span>
            <span>Estado</span>
          </div>
          {terminologyComparisons.map((item) => (
            <article className="table-row sector-terms-grid" key={item.area}>
              <strong>{item.area}</strong>
              <span>{item.construction}</span>
              <span>{item.cleaning}</span>
              <StatusBadge label={item.status} tone={readinessTone[item.status]} />
            </article>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Readiness por modulo</h2>
            <p className="activity-meta">Evalua reutilizacion del nucleo comun y puntos donde Aseo necesita variantes.</p>
          </div>
          <StatusBadge label="Sin activar Aseo" tone="warning" />
        </div>
        <div className="responsive-table">
          <div className="table-header sector-modules-grid">
            <span>Modulo</span>
            <span>Construccion</span>
            <span>Aseo</span>
            <span>Estado</span>
            <span>Riesgo</span>
          </div>
          {moduleReadiness.map((item) => (
            <article className="table-row sector-modules-grid" key={item.moduleId}>
              <strong>{item.moduleId}</strong>
              <span>{item.constructionUse}</span>
              <span>{item.cleaningUse}</span>
              <StatusBadge label={item.status} tone={readinessTone[item.status]} />
              <StatusBadge label={item.risk} tone={riskTone[item.risk]} />
            </article>
          ))}
        </div>
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        {sectorScenarios.map((scenario) => (
          <article className="card" key={scenario.scenarioId}>
            <div className="card-title-row">
              <h2 className="card-title">{scenario.title}</h2>
              <StatusBadge label="Escenario" tone="info" />
            </div>
            <div className="grid proof-grid">
              <VisualField label="Construccion" value={scenario.constructionFlow} />
              <VisualField label="Aseo" value={scenario.cleaningFlow} />
            </div>
            <p className="activity-meta" style={{ marginTop: 12 }}>
              {scenario.decision}
            </p>
          </article>
        ))}
      </section>

      <section className="worker-card" style={{ marginTop: 18 }}>
        <h2 className="card-title">Limites de fase</h2>
        <p className="activity-meta">
          Esta validacion no cambia rutas, datos, permisos ni textos globales en tiempo real. La activacion real de Aseo queda para fases F3/F4 con
          plantillas, migraciones, permisos, pruebas y QA sectorial.
        </p>
      </section>
    </>
  );
}
