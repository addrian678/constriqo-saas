import { BarChart3, Building2, CalendarClock, ClipboardCheck, Clock3, FileText, Receipt, Users } from "lucide-react";
import { ActivityList } from "../../../shared/components/ActivityList";
import { AlertCard } from "../../../shared/components/AlertCard";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { managerActivities, managerStats } from "../../../verticals/construction/mock-data/dashboard";

const statIcons = [Building2, CalendarClock, FileText, Users, Clock3, ClipboardCheck, Receipt, BarChart3];

export function ManagerHome() {
  return (
    <>
      <PageHeader
        eyebrow="Gestor de empresa"
        title="Inicio operativo"
        description="Panel administrativo limitado para coordinar obras, trabajadores, partes diarios y proximas actividades."
        actions={<StatusBadge label="Sin configuracion critica" tone="success" />}
      />
      <section className="grid stats-grid">
        {managerStats.map((stat, index) => (
          <StatCard key={stat.label} icon={statIcons[index]} {...stat} />
        ))}
      </section>
      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Proximas actividades</h2>
            <StatusBadge label="Agenda visual" tone="info" />
          </div>
          <ActivityList items={managerActivities} />
        </div>
        <div className="grid">
          <AlertCard
            title="Partes diarios pendientes"
            text="Seis partes diarios ficticios esperan revision visual. No hay validaciones reales."
            badge="Pendiente"
            tone="warning"
          />
          <AlertCard
            title="Horas por aprobar"
            text="La aprobacion queda representada como estado visual para fases posteriores."
            badge="Revision"
            tone="info"
          />
        </div>
      </section>
    </>
  );
}
