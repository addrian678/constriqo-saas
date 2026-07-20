import { BadgeDollarSign, BriefcaseBusiness, Building2, Landmark, RefreshCw, TrendingUp, Users, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { AuthenticatedSession } from "../../../app/auth/authClient";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { listCrmClients } from "../../crm/api/crmClient";
import { getCachedFinanceDashboard, getFinanceDashboard, type FinanceDashboard } from "../../finance/api/financeClient";
import { listInvoices } from "../../invoicing/api/invoiceClient";
import { listJobs } from "../../jobs/api/jobClient";
import { listWorkers } from "../../workforce/api/workforceClient";

type BusinessOverviewRealPageProps = {
  session: AuthenticatedSession;
};

type OverviewCounts = {
  clients: number;
  jobs: number;
  workers: number;
  openInvoices: number;
};

type FinancePeriodKey = "today" | "week" | "month" | "year";

export function BusinessOverviewRealPage({ session }: BusinessOverviewRealPageProps) {
  const [dashboard, setDashboard] = useState<FinanceDashboard | null>(() => getCachedFinanceDashboard(session.sessionToken));
  const [counts, setCounts] = useState<OverviewCounts>({ clients: 0, jobs: 0, workers: 0, openInvoices: 0 });
  const [selectedPeriod, setSelectedPeriod] = useState<FinancePeriodKey>("today");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const refreshIdRef = useRef(0);

  const currency = dashboard?.currency || "USD";
  const visiblePeriod = selectedMonth
    ? dashboard?.monthlyHistory?.find((item) => item.month === selectedMonth) || null
    : dashboard?.periods[selectedPeriod] || null;

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    function handleDataChanged() {
      void refresh();
    }

    window.addEventListener("constriqo:data-changed", handleDataChanged);
    return () => {
      window.removeEventListener("constriqo:data-changed", handleDataChanged);
    };
  }, [session.sessionToken]);

  async function refresh() {
    const refreshId = refreshIdRef.current + 1;
    refreshIdRef.current = refreshId;
    setLoading(true);
    setMessage(null);
    const errors: string[] = [];
    let pending = 5;

    function isCurrentRefresh() {
      return refreshIdRef.current === refreshId;
    }

    function finish(label: string, ok: boolean) {
      if (!isCurrentRefresh()) {
        return;
      }
      if (!ok) {
        errors.push(label);
      }
      pending -= 1;
      setMessage(errors.length > 0 ? `Resumen parcial: no se pudo cargar ${errors.join(", ")}.` : null);
      if (pending === 0) {
        setLoading(false);
      }
    }

    void getFinanceDashboard(session.sessionToken)
      .then((value) => {
        if (isCurrentRefresh()) {
          setDashboard(value);
        }
        finish("finanzas", true);
      })
      .catch(() => finish("finanzas", false));

    void listCrmClients(session.sessionToken)
      .then((value) => {
        if (isCurrentRefresh()) {
          setCounts((current) => ({ ...current, clients: value.summary?.total || value.items.length }));
        }
        finish("clientes", true);
      })
      .catch(() => finish("clientes", false));

    void listJobs(session.sessionToken)
      .then((value) => {
        if (isCurrentRefresh()) {
          setCounts((current) => ({ ...current, jobs: value.summary?.total || value.items.length }));
        }
        finish("obras", true);
      })
      .catch(() => finish("obras", false));

    void listWorkers(session.sessionToken)
      .then((value) => {
        if (isCurrentRefresh()) {
          setCounts((current) => ({ ...current, workers: value.items.length }));
        }
        finish("trabajadores", true);
      })
      .catch(() => finish("trabajadores", false));

    void listInvoices(session.sessionToken)
      .then((value) => {
        if (isCurrentRefresh()) {
          setCounts((current) => ({
            ...current,
            openInvoices: value.items.filter((invoice) => invoice.balanceAmount > 0 && invoice.status !== "draft").length,
          }));
        }
        finish("facturas", true);
      })
      .catch(() => finish("facturas", false));
  }

  return (
    <section className="production-module-content">
      <PageHeader
        eyebrow="Inicio real"
        title="Resumen de empresa"
        description="Balance calculado desde facturas, cobros, egresos, activos, pasivos, obras y clientes del tenant activo."
        actions={
          <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>
            Actualizar
          </Button>
        }
      />

      {message ? <p className="login-notice">{message}</p> : null}

      <section className="grid stats-grid crm-real-stats">
        <SummaryCard label="Ingresos mes" value={dashboard ? formatMoney(dashboard.summary.income, currency) : "Cargando"} icon={<BadgeDollarSign size={20} />} tone="success" note="Mes calendario actual" />
        <SummaryCard label="Egresos mes" value={dashboard ? formatMoney(dashboard.summary.expenses, currency) : "Cargando"} icon={<WalletCards size={20} />} tone="warning" note="Mes calendario actual" />
        <SummaryCard label="Activos" value={dashboard ? formatMoney(dashboard.summary.assets, currency) : "Cargando"} icon={<Building2 size={20} />} tone="info" />
        <SummaryCard label="Pasivos" value={dashboard ? formatMoney(dashboard.summary.liabilities, currency) : "Cargando"} icon={<Landmark size={20} />} tone="danger" />
        <SummaryCard label="Utilidad mes" value={dashboard ? formatMoney(dashboard.summary.netProfit, currency) : "Cargando"} icon={<TrendingUp size={20} />} tone={(dashboard?.summary.netProfit || 0) >= 0 ? "success" : "danger"} note="Mes calendario actual" />
        <SummaryCard label="Balance empresa" value={dashboard ? formatMoney(dashboard.summary.equity, currency) : "Cargando"} icon={<Landmark size={20} />} tone={(dashboard?.summary.equity || 0) >= 0 ? "success" : "warning"} />
        <SummaryCard label="Por cobrar" value={dashboard ? formatMoney(dashboard.summary.receivables, currency) : "Cargando"} icon={<BadgeDollarSign size={20} />} tone="info" />
        <SummaryCard label="Por pagar" value={dashboard ? formatMoney(dashboard.summary.payables, currency) : "Cargando"} icon={<WalletCards size={20} />} tone="warning" />
      </section>

      <section className="grid two-column crm-real-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Resumen por periodo</h2>
            <StatusBadge label={currency} tone="info" />
          </div>
          <PeriodControls
            selectedPeriod={selectedPeriod}
            selectedMonth={selectedMonth}
            months={dashboard?.monthlyHistory || []}
            onSelectPeriod={(period) => {
              setSelectedPeriod(period);
              setSelectedMonth("");
            }}
            onSelectMonth={setSelectedMonth}
          />
          {visiblePeriod ? (
            <PeriodSnapshot title={selectedMonth ? monthLabel(selectedMonth) : periodLabel(selectedPeriod)} value={visiblePeriod} currency={currency} />
          ) : (
            <p className="activity-meta">Cargando periodo financiero...</p>
          )}
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Operacion</h2>
            <StatusBadge label={loading ? "Cargando" : "Real"} tone={loading ? "neutral" : "success"} />
          </div>
          <div className="grid proof-grid">
            <MiniMetric label="Clientes" value={loading && counts.clients === 0 ? "Cargando" : counts.clients} icon={<Users size={18} />} />
            <MiniMetric label="Obras" value={loading && counts.jobs === 0 ? "Cargando" : counts.jobs} icon={<BriefcaseBusiness size={18} />} />
            <MiniMetric label="Trabajadores" value={loading && counts.workers === 0 ? "Cargando" : counts.workers} icon={<Users size={18} />} />
            <MiniMetric label="Facturas abiertas" value={loading && counts.openInvoices === 0 ? "Cargando" : counts.openInvoices} icon={<BadgeDollarSign size={18} />} />
          </div>
          {!loading && counts.clients + counts.jobs + counts.workers + counts.openInvoices === 0 ? (
            <EmptyState title="Sin datos reales todavia" description="Agrega clientes, cotizaciones, facturas y obras para alimentar el resumen." />
          ) : null}
        </div>
      </section>
    </section>
  );
}

function SummaryCard({ icon, label, value, tone, note = "Calculado desde datos reales del tenant" }: { icon: ReactNode; label: string; value: string; tone: "info" | "success" | "warning" | "danger"; note?: string }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
        </div>
        <span className={`stat-icon ${tone}`}>{icon}</span>
      </div>
      <span className="stat-note">{note}</span>
    </article>
  );
}

function PeriodControls({
  selectedPeriod,
  selectedMonth,
  months,
  onSelectPeriod,
  onSelectMonth,
}: {
  selectedPeriod: FinancePeriodKey;
  selectedMonth: string;
  months: Array<{ month: string }>;
  onSelectPeriod: (period: FinancePeriodKey) => void;
  onSelectMonth: (month: string) => void;
}) {
  return (
    <div className="filters-row">
      <label className="form-control filter-control">
        <span>Periodo</span>
        <select className="select" value={selectedMonth ? "history" : selectedPeriod} onChange={(event) => {
          if (event.target.value === "history") {
            onSelectMonth(months[0]?.month || "");
            return;
          }
          onSelectPeriod(event.target.value as FinancePeriodKey);
        }}>
          <option value="today">Hoy</option>
          <option value="week">Semana actual</option>
          <option value="month">Mes actual</option>
          <option value="year">Año actual</option>
          <option value="history">Historial mensual</option>
        </select>
      </label>
      {selectedMonth ? (
        <label className="form-control filter-control">
          <span>Mes</span>
          <select className="select" value={selectedMonth} onChange={(event) => onSelectMonth(event.target.value)}>
            {months.map((item) => (
              <option value={item.month} key={item.month}>{monthLabel(item.month)}</option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

function PeriodSnapshot({ title, value, currency }: { title: string; value: { income: number; expenses: number; netProfit: number }; currency: string }) {
  return (
    <article className="table-row finance-table-grid" style={{ marginTop: 12 }}>
      <strong>{title}</strong>
      <span>{formatMoney(value.income, currency)}</span>
      <span>{formatMoney(value.expenses, currency)}</span>
      <strong>{formatMoney(value.netProfit, currency)}</strong>
      <StatusBadge label={value.netProfit >= 0 ? "Positivo" : "Negativo"} tone={value.netProfit >= 0 ? "success" : "danger"} />
    </article>
  );
}

function MiniMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <article className="stat-card compact-stat-card">
      <div className="stat-top">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
        </div>
        <span className="stat-icon info">{icon}</span>
      </div>
    </article>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(value || 0);
}

function periodLabel(period: string) {
  return { today: "Hoy", week: "Semana actual", month: "Mes actual", year: "Año actual" }[period] || period;
}

function monthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(date);
}
