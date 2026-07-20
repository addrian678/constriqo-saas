import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart3,
  Building2,
  Clock3,
  DollarSign,
  FileText,
  Receipt,
} from "lucide-react";
import { ActivityList } from "../../../shared/components/ActivityList";
import { AlertCard } from "../../../shared/components/AlertCard";
import { DocumentLanguageSelector } from "../../../shared/components/DocumentLanguageSelector";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { adminActivity, adminStats } from "../../../verticals/construction/mock-data/dashboard";

const statIcons = [DollarSign, BadgeDollarSign, Receipt, BarChart3, FileText, AlertTriangle, Building2, Clock3];

export function AdminHome() {
  return (
    <>
      <PageHeader
        eyebrow="Administrador"
        title="Inicio"
        description="Vista ejecutiva con datos simulados para validar la base visual, el sistema de diseno y la navegacion modular."
        actions={<StatusBadge label="Perfil construccion activo" tone="info" />}
      />
      <section className="grid stats-grid">
        {adminStats.map((stat, index) => (
          <StatCard key={stat.label} icon={statIcons[index]} {...stat} />
        ))}
      </section>
      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Indicadores visuales simulados</h2>
            <StatusBadge label="Sin calculos reales" tone="neutral" />
          </div>
          <div className="chart-bars">
            {[
              ["Ingresos", "72%", "#1f8a5b"],
              ["Egresos", "44%", "#b7791f"],
              ["Por cobrar", "38%", "#2563a8"],
              ["Horas por revisar", "31%", "#c2413a"],
            ].map(([label, width, color]) => (
              <div className="bar-row" key={label}>
                <span>{label}</span>
                <span className="bar-track">
                  <span className="bar-fill" style={{ width, background: color }} />
                </span>
                <strong>{width}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="grid">
          <AlertCard
            title="Alertas"
            text="Hay 18 horas pendientes de revision y 3 facturas abiertas en datos ficticios."
            badge="Atencion"
            tone="warning"
          />
          <AlertCard
            title="Cotizaciones pendientes"
            text="Cinco oportunidades visuales listas para seguimiento en una fase posterior."
            badge="Pendiente"
            tone="info"
          />
        </div>
      </section>
      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Actividad reciente</h2>
            <StatusBadge label="Simulada" tone="neutral" />
          </div>
          <ActivityList items={adminActivity} />
        </div>
        <DocumentLanguageSelector />
      </section>
    </>
  );
}
