import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeDollarSign, ClockAlert, FileText, Receipt, Search } from "lucide-react";
import { clients } from "../../crm/mock-data/crmData";
import { DocumentLanguageSelector } from "../../../shared/components/DocumentLanguageSelector";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { invoices, receivablesSummary, type InvoiceStatus } from "../mock-data/invoicingData";

const invoiceTone: Record<InvoiceStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Borrador: "neutral",
  "Enviada visualmente": "info",
  Vencida: "danger",
  "Pagada visualmente": "success",
  "Pago parcial": "warning",
};

type InvoicesPageProps = {
  basePath: "/admin/facturas" | "/manager/facturas";
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function InvoicesPage({ basePath, roleLabel }: InvoicesPageProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "Todos">("Todos");

  const filteredInvoices = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const client = clients.find((item) => item.clientId === invoice.clientId);
      const matchesQuery =
        !normalizedQuery ||
        [invoice.invoiceNumber, invoice.title, invoice.status, client?.name || ""].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      const matchesStatus = status === "Todos" || invoice.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status]);

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - V0.9`}
        title="Facturas"
        description="Documentos de cobro, vencimientos, pagos simulados, recibos y saldos visuales. Sin fiscalidad, pagos reales ni PDF."
      />

      <section className="grid stats-grid">
        <StatCard label="Por cobrar" value={receivablesSummary.totalOpen} note="Saldo visual" tone="info" icon={BadgeDollarSign} />
        <StatCard label="Vencido" value={receivablesSummary.overdue} note="Sin recordatorio real" tone="danger" icon={ClockAlert} />
        <StatCard label="Cobrado visual" value={receivablesSummary.collectedVisual} note="Pago simulado" tone="positive" icon={Receipt} />
        <StatCard label="Borradores" value={receivablesSummary.draftVisual} note="Sin emision" tone="warning" icon={FileText} />
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Listado de facturas</h2>
              <p className="activity-meta">Los importes son de demostracion y no tienen validez fiscal ni contable.</p>
            </div>
            <StatusBadge label="V0.9 visual" tone="info" />
          </div>
          <div className="filters-row">
            <label className="search-box crm-search">
              <Search size={18} />
              <input
                aria-label="Buscar facturas"
                placeholder="Buscar por numero, cliente o estado"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="form-control filter-control">
              <span className="visual-field-label">Estado</span>
              <select className="select" value={status} onChange={(event) => setStatus(event.target.value as InvoiceStatus | "Todos")}>
                <option>Todos</option>
                <option>Borrador</option>
                <option>Enviada visualmente</option>
                <option>Vencida</option>
                <option>Pagada visualmente</option>
                <option>Pago parcial</option>
              </select>
            </label>
          </div>

          {filteredInvoices.length > 0 ? (
            <div className="responsive-table" style={{ marginTop: 16 }}>
              <div className="table-header invoices-table-grid">
                <span>Factura</span>
                <span>Cliente</span>
                <span>Estado</span>
                <span>Saldo</span>
                <span>Accion</span>
              </div>
              {filteredInvoices.map((invoice) => {
                const client = clients.find((item) => item.clientId === invoice.clientId);
                return (
                  <article className="table-row invoices-table-grid" key={invoice.invoiceId}>
                    <div>
                      <strong>{invoice.invoiceNumber}</strong>
                      <p className="activity-meta">{invoice.title}</p>
                    </div>
                    <div>
                      <strong>{client?.name}</strong>
                      <p className="activity-meta">Vence {invoice.dueDate}</p>
                    </div>
                    <StatusBadge label={invoice.status} tone={invoiceTone[invoice.status]} />
                    <strong>{invoice.balance}</strong>
                    <Link className="button button-secondary" to={`${basePath}/${invoice.invoiceId}`}>
                      Ver detalle
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Sin facturas" description="No hay resultados para los filtros actuales." />
          )}
        </div>

        <DocumentLanguageSelector />
      </section>
    </>
  );
}
