import { BadgeDollarSign, Banknote, BarChart3, Landmark, TrendingUp, WalletCards } from "lucide-react";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { cashTransactions, financeSummary, financialAccounts, jobProfitabilityVisual } from "../mock-data/financeData";

type FinancePageProps = {
  roleLabel: "Administrador" | "Gestor de empresa";
  mode?: "full" | "operational";
};

export function FinancePage({ roleLabel, mode = "full" }: FinancePageProps) {
  const isOperational = mode === "operational";

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - V0.11`}
        title={isOperational ? "Informes operativos" : "Finanzas"}
        description={
          isOperational
            ? "Vista operativa con cobros, gastos y rentabilidad visual autorizada. Sin contabilidad definitiva."
            : "Cuentas, movimientos, flujo de caja, resultados, balance y rentabilidad visual. Sin contabilidad productiva."
        }
      />

      <section className="grid stats-grid">
        <StatCard label="Caja disponible" value={financeSummary.cashAvailable} note="Visual" tone="info" icon={Banknote} />
        <StatCard label="Por cobrar" value={financeSummary.receivables} note="Desde facturas visuales" tone="positive" icon={BadgeDollarSign} />
        <StatCard label="Por pagar" value={financeSummary.payables} note="Desde gastos visuales" tone="warning" icon={WalletCards} />
        <StatCard label="Posicion neta" value={financeSummary.netPositionVisual} note="No contable" tone="danger" icon={TrendingUp} />
      </section>

      {!isOperational ? (
        <section className="grid two-column" style={{ marginTop: 18 }}>
          <div className="card">
            <div className="card-title-row">
              <h2 className="card-title">Cuentas</h2>
              <StatusBadge label="Visual" tone="neutral" />
            </div>
            <div className="grid">
              {financialAccounts.map((account) => (
                <article className="alert-card" key={account.accountId}>
                  <div className="alert-heading">
                    <h3 className="alert-title">{account.name}</h3>
                    <StatusBadge label={account.status} tone={account.status === "Revision" ? "warning" : "success"} />
                  </div>
                  <p className="alert-text">{account.type} - {account.balance}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-title-row">
              <h2 className="card-title">Resultado visual del mes</h2>
              <BarChart3 size={20} />
            </div>
            <div className="grid proof-grid">
              <VisualField label="Ingresos" value={financeSummary.monthlyIncome} />
              <VisualField label="Egresos" value={financeSummary.monthlyExpenses} />
              <VisualField label="Beneficio estimado" value={financeSummary.estimatedProfit} />
              <VisualField label="Estado" value="No es cierre contable" />
            </div>
          </div>
        </section>
      ) : null}

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Movimientos recientes</h2>
            <p className="activity-meta">Movimientos de demostracion; no hay conciliacion ni libro contable real.</p>
          </div>
          <Landmark size={20} />
        </div>
        <div className="responsive-table">
          <div className="table-header finance-table-grid">
            <span>Fecha</span>
            <span>Descripcion</span>
            <span>Tipo</span>
            <span>Categoria</span>
            <span>Importe</span>
          </div>
          {cashTransactions.map((transaction) => (
            <article className="table-row finance-table-grid" key={transaction.transactionId}>
              <span>{transaction.date}</span>
              <div>
                <strong>{transaction.description}</strong>
                <p className="activity-meta">{transaction.relatedEntity}</p>
              </div>
              <StatusBadge
                label={transaction.type}
                tone={transaction.type === "Ingreso visual" ? "success" : transaction.type === "Egreso visual" ? "danger" : "info"}
              />
              <span>{transaction.category}</span>
              <strong>{transaction.amount}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <h2 className="card-title">Rentabilidad visual por obra</h2>
          <StatusBadge label="Sin calculo definitivo" tone="warning" />
        </div>
        <div className="responsive-table">
          <div className="table-header profitability-table-grid">
            <span>Obra</span>
            <span>Ingresos</span>
            <span>Costes</span>
            <span>Margen</span>
            <span>Estado</span>
          </div>
          {jobProfitabilityVisual.map((item) => (
            <article className="table-row profitability-table-grid" key={item.job}>
              <strong>{item.job}</strong>
              <span>{item.income}</span>
              <span>{item.cost}</span>
              <strong>{item.margin}</strong>
              <StatusBadge label={item.status} tone={item.margin.startsWith("-") ? "danger" : "success"} />
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
