import { BadgeDollarSign, ClockAlert, Receipt } from "lucide-react";
import { clients } from "../../crm/mock-data/crmData";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { invoices, receivablesSummary } from "../mock-data/invoicingData";

type ReceivablesPageProps = {
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function ReceivablesPage({ roleLabel }: ReceivablesPageProps) {
  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - V0.9`}
        title="Cobros"
        description="Cartera visual de cuentas por cobrar, vencimientos y pagos simulados. Sin pasarela, banco ni recordatorios reales."
      />
      <section className="grid stats-grid">
        <StatCard label="Abierto" value={receivablesSummary.totalOpen} note="Saldo visual" tone="info" icon={BadgeDollarSign} />
        <StatCard label="Vencido" value={receivablesSummary.overdue} note="Sin gestion real" tone="danger" icon={ClockAlert} />
        <StatCard label="Cobrado" value={receivablesSummary.collectedVisual} note="Simulado" tone="positive" icon={Receipt} />
      </section>
      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <h2 className="card-title">Cartera</h2>
          <StatusBadge label="Visual" tone="neutral" />
        </div>
        <div className="responsive-table">
          <div className="table-header receivables-table-grid">
            <span>Cliente</span>
            <span>Factura</span>
            <span>Vence</span>
            <span>Estado</span>
            <span>Saldo</span>
          </div>
          {invoices.map((invoice) => {
            const client = clients.find((item) => item.clientId === invoice.clientId);
            return (
              <article className="table-row receivables-table-grid" key={invoice.invoiceId}>
                <strong>{client?.name}</strong>
                <span>{invoice.invoiceNumber}</span>
                <span>{invoice.dueDate}</span>
                <StatusBadge label={invoice.status} tone={invoice.status === "Vencida" ? "danger" : "neutral"} />
                <strong>{invoice.balance}</strong>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
