import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Receipt } from "lucide-react";
import { clients } from "../../crm/mock-data/crmData";
import { jobs } from "../../jobs/mock-data/jobsData";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { invoices, type InvoiceStatus } from "../mock-data/invoicingData";

const invoiceTone: Record<InvoiceStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Borrador: "neutral",
  "Enviada visualmente": "info",
  Vencida: "danger",
  "Pagada visualmente": "success",
  "Pago parcial": "warning",
};

type InvoiceDetailPageProps = {
  basePath: "/admin/facturas" | "/manager/facturas";
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function InvoiceDetailPage({ basePath, roleLabel }: InvoiceDetailPageProps) {
  const { invoiceId } = useParams();
  const invoice = invoices.find((item) => item.invoiceId === invoiceId);

  if (!invoice) {
    return (
      <>
        <PageHeader eyebrow={roleLabel} title="Factura no encontrada" />
        <EmptyState title="Detalle no disponible" description="El identificador no existe en los datos simulados." />
      </>
    );
  }

  const client = clients.find((item) => item.clientId === invoice.clientId);
  const job = jobs.find((item) => item.jobId === invoice.jobId);

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - Detalle V0.9`}
        title={`${invoice.invoiceNumber} - ${invoice.title}`}
        description="Detalle visual de cobro con partidas, pagos simulados, recibos y saldo. Sin emision fiscal ni pago real."
        actions={
          <Link className="button button-secondary" to={basePath}>
            <ArrowLeft size={18} />
            Volver
          </Link>
        }
      />

      <section className="grid two-column">
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Resumen</h2>
            <StatusBadge label={invoice.status} tone={invoiceTone[invoice.status]} />
          </div>
          <div className="grid proof-grid">
            <VisualField label="invoiceId" value={invoice.invoiceId} />
            <VisualField label="Cliente" value={client?.name || invoice.clientId} />
            <VisualField label="Obra" value={job?.jobNumber || invoice.jobId} />
            <VisualField label="Idioma" value={invoice.language} />
            <VisualField label="Emitida" value={invoice.issueDate} />
            <VisualField label="Vence" value={invoice.dueDate} />
            <VisualField label="Total" value={invoice.total} />
            <VisualField label="Saldo" value={invoice.balance} />
          </div>
          <p className="activity-meta" style={{ marginTop: 14 }}>
            {invoice.notes}
          </p>
        </div>

        <div className="document-preview">
          <div className="preview-paper">
            <p className="eyebrow">Invoice preview</p>
            <h2>{invoice.invoiceNumber}</h2>
            <p>{client?.name}</p>
            <hr />
            <p>{invoice.title}</p>
            <strong>Total {invoice.total}</strong>
            <p className="activity-meta">Balance {invoice.balance}</p>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <h2 className="card-title">Partidas</h2>
          <FileText size={20} />
        </div>
        <div className="responsive-table">
          <div className="table-header invoice-items-grid">
            <span>Descripcion</span>
            <span>Cantidad</span>
            <span>Precio</span>
            <span>Importe</span>
          </div>
          {invoice.items.map((item) => (
            <article className="table-row invoice-items-grid" key={item.invoiceItemId}>
              <strong>{item.description}</strong>
              <span>{item.quantity}</span>
              <span>{item.unitPrice}</span>
              <strong>{item.amount}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Pagos y recibos</h2>
            <Receipt size={20} />
          </div>
          <div className="responsive-table">
            {invoice.payments.length > 0 ? (
              invoice.payments.map((payment) => (
                <article className="table-row payment-row-grid" key={payment.paymentId}>
                  <div>
                    <strong>{payment.amount}</strong>
                    <p className="activity-meta">{payment.date}</p>
                  </div>
                  <span>{payment.method}</span>
                  <StatusBadge label={payment.status} tone={payment.status === "Pendiente" ? "warning" : "success"} />
                  <span>{payment.receiptNumber}</span>
                </article>
              ))
            ) : (
              <article className="alert-card">
                <h3 className="alert-title">Sin pagos registrados</h3>
                <p className="alert-text">Estado visual. No hay integracion de pagos ni recibo real.</p>
              </article>
            )}
          </div>
        </div>
        <div className="card">
          <h2 className="card-title">Totales visuales</h2>
          <div className="grid proof-grid" style={{ marginTop: 14 }}>
            <VisualField label="Subtotal" value={invoice.subtotal} />
            <VisualField label="Impuestos" value={invoice.taxVisual} />
            <VisualField label="Pagado" value={invoice.paid} />
            <VisualField label="Pendiente" value={invoice.balance} />
          </div>
        </div>
      </section>
    </>
  );
}
