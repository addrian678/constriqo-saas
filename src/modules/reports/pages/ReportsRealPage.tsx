import { Activity, BarChart3, Bell, BriefcaseBusiness, Clock3, Landmark, Megaphone, RefreshCw, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { AuthenticatedSession } from "../../../app/auth/authClient";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { getReportsSummary, type ReportsSummary } from "../api/reportsClient";

type ReportsRealPageProps = {
  session: AuthenticatedSession;
};

export function ReportsRealPage({ session }: ReportsRealPageProps) {
  const [report, setReport] = useState<ReportsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const currency = report?.currency || "USD";

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setMessage(null);
    try {
      setReport(await getReportsSummary(session.sessionToken));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar los reportes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="production-module-content">
      <PageHeader
        eyebrow="Reportes reales F12"
        title="Reportes de empresa"
        description="Resumen ejecutivo calculado desde finanzas, obras, asistencia, marketing, auditoria y documentos reales del tenant."
        actions={
          <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>
            Actualizar
          </Button>
        }
      />

      {message ? <p className="login-notice">{message}</p> : null}

      <section className="grid stats-grid crm-real-stats">
        <SummaryCard label="Utilidad" value={loading && !report ? "Cargando" : formatMoney(report?.financial.netProfit || 0, currency)} icon={<BarChart3 size={20} />} />
        <SummaryCard label="Balance" value={loading && !report ? "Cargando" : formatMoney(report?.financial.equity || 0, currency)} icon={<Landmark size={20} />} />
        <SummaryCard label="Obras abiertas" value={loading && !report ? "Cargando" : report?.operations.openJobs || 0} icon={<BriefcaseBusiness size={20} />} />
        <SummaryCard label="Horas mes" value={loading && !report ? "Cargando" : report?.attendance.hoursMonth || 0} icon={<Clock3 size={20} />} />
      </section>

      {!loading && !report ? <EmptyState title="Sin reportes" description="No fue posible calcular el resumen real." /> : null}

      {report ? (
        <section className="grid two-column crm-real-grid" style={{ marginTop: 16 }}>
          <ReportCard
            title="Financiero"
            badge={currency}
            icon={<Landmark size={18} />}
            rows={[
              ["Ingresos", formatMoney(report.financial.income, currency)],
              ["Egresos", formatMoney(report.financial.expenses, currency)],
              ["Por cobrar", formatMoney(report.financial.receivables, currency)],
              ["Por pagar", formatMoney(report.financial.payables, currency)],
              ["Activos", formatMoney(report.financial.assets, currency)],
              ["Pasivos", formatMoney(report.financial.liabilities, currency)],
            ]}
          />
          <ReportCard
            title="Operativo"
            badge="Obras"
            icon={<BriefcaseBusiness size={18} />}
            rows={[
              ["Clientes activos", report.operations.clients],
              ["Obras abiertas", report.operations.openJobs],
              ["Trabajadores activos", report.operations.activeWorkers],
              ["Tareas", report.operations.tasks],
              ["Tareas completadas", report.operations.completedTasks],
            ]}
          />
          <ReportCard
            title="Asistencia"
            badge="Mes actual"
            icon={<Clock3 size={18} />}
            rows={[
              ["Registros del mes", report.attendance.entriesMonth],
              ["Jornadas abiertas", report.attendance.openEntries],
              ["Horas registradas", report.attendance.hoursMonth],
            ]}
          />
          <ReportCard
            title="Marketing"
            badge="Leads"
            icon={<Megaphone size={18} />}
            rows={[
              ["Campanas", report.marketing.campaigns],
              ["Leads", report.marketing.leads],
              ["Leads convertidos", report.marketing.convertedLeads],
              ["Tarjetas activas", report.marketing.activeLoyaltyCards],
              ["Tarjetas listas para canje", report.marketing.readyLoyaltyCards],
            ]}
          />
          <ReportCard
            title="Control"
            badge="30 dias"
            icon={<Activity size={18} />}
            rows={[
              ["Eventos de auditoria", report.control.auditEvents30d],
              ["Notificaciones pendientes", report.control.pendingNotifications],
              ["Documentos activos", report.control.activeDocuments],
            ]}
          />
          <ReportCard
            title="Usuarios"
            badge="SaaS"
            icon={<Users size={18} />}
            rows={[
              ["Empresa", session.tenant.companyName],
              ["Generado", formatDate(report.generatedAt)],
              ["Alertas", report.control.pendingNotifications > 0 ? "Revisar pendientes" : "Sin pendientes"],
            ]}
          />
        </section>
      ) : null}
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
      <span className="stat-note">Calculado en tiempo real</span>
    </article>
  );
}

function ReportCard({ badge, icon, rows, title }: { badge: string; icon: ReactNode; rows: Array<[string, string | number]>; title: string }) {
  return (
    <article className="card">
      <div className="card-title-row">
        <div className="brand-lockup">
          <span className="activity-icon">{icon}</span>
          <h2 className="card-title">{title}</h2>
        </div>
        <StatusBadge label={badge} tone="info" />
      </div>
      <div className="responsive-table">
        {rows.map(([label, value]) => (
          <article className="table-row finance-table-grid" key={label}>
            <strong>{label}</strong>
            <span>{value}</span>
            <span />
            <span />
            <span />
          </article>
        ))}
      </div>
    </article>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(value || 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
