import { Activity, LockKeyhole, ShieldCheck, UserCheck } from "lucide-react";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { auditSummary, visualAuditEvents } from "../mock-data/notificationsData";

const resultTone: Record<(typeof visualAuditEvents)[number]["result"], "neutral" | "info" | "warning" | "success" | "danger"> = {
  "Permitido visual": "success",
  "Bloqueado visual": "danger",
  Revision: "warning",
};

export function AuditPage() {
  return (
    <>
      <PageHeader
        eyebrow="Administrador - V0.13"
        title="Auditoria"
        description="Bitacora visual de acciones, permisos y eventos relevantes. Sin retencion legal, firma, IP real ni trazabilidad productiva."
      />

      <section className="grid stats-grid">
        <StatCard label="Eventos" value={auditSummary.events} note="Simulados" tone="info" icon={Activity} />
        <StatCard label="Bloqueados" value={auditSummary.blocked} note="Permiso visual" tone="danger" icon={LockKeyhole} />
        <StatCard label="Revision" value={auditSummary.reviewed} note="Sin flujo real" tone="warning" icon={ShieldCheck} />
        <StatCard label="Retencion" value={auditSummary.retained} note="No legal" tone="positive" icon={UserCheck} />
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Eventos recientes</h2>
            <p className="activity-meta">La auditoria es metadata estatica para validar UX y permisos esperados.</p>
          </div>
          <StatusBadge label="Solo lectura" tone="neutral" />
        </div>
        <div className="responsive-table">
          <div className="table-header audit-table-grid">
            <span>Fecha</span>
            <span>Actor</span>
            <span>Accion</span>
            <span>Modulo</span>
            <span>Resultado</span>
          </div>
          {visualAuditEvents.map((event) => (
            <article className="table-row audit-table-grid" key={event.auditId}>
              <span>{event.date}</span>
              <div>
                <strong>{event.actor}</strong>
                <p className="activity-meta">{event.role}</p>
              </div>
              <div>
                <strong>{event.action}</strong>
                <p className="activity-meta">{event.entity}</p>
              </div>
              <span>{event.module}</span>
              <StatusBadge label={event.result} tone={resultTone[event.result]} />
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
