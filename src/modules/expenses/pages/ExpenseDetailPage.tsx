import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, ReceiptText } from "lucide-react";
import { jobs } from "../../jobs/mock-data/jobsData";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { expenses, vendors, type ExpenseStatus } from "../mock-data/expensesData";

const expenseTone: Record<ExpenseStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Borrador: "neutral",
  "Pendiente de aprobacion": "warning",
  "Aprobado visualmente": "success",
  Vencido: "danger",
  "Pagado visualmente": "info",
};

type ExpenseDetailPageProps = {
  basePath: "/admin/gastos" | "/manager/gastos";
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function ExpenseDetailPage({ basePath, roleLabel }: ExpenseDetailPageProps) {
  const { expenseId } = useParams();
  const expense = expenses.find((item) => item.expenseId === expenseId);

  if (!expense) {
    return (
      <>
        <PageHeader eyebrow={roleLabel} title="Gasto no encontrado" />
        <EmptyState title="Detalle no disponible" description="El identificador no existe en los datos simulados." />
      </>
    );
  }

  const vendor = vendors.find((item) => item.vendorId === expense.vendorId);
  const job = jobs.find((item) => item.jobId === expense.jobId);

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - Detalle V0.10`}
        title={`${expense.billNumber} - ${vendor?.name}`}
        description="Detalle visual de compra/cuenta por pagar con partidas, aprobacion y vencimiento. Sin pago ni asiento real."
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
            <StatusBadge label={expense.status} tone={expenseTone[expense.status]} />
          </div>
          <div className="grid proof-grid">
            <VisualField label="expenseId" value={expense.expenseId} />
            <VisualField label="Proveedor" value={vendor?.name || expense.vendorId} />
            <VisualField label="Obra" value={job?.jobNumber || expense.jobId} />
            <VisualField label="Categoria" value={expense.category} />
            <VisualField label="Emitida" value={expense.issueDate} />
            <VisualField label="Vence" value={expense.dueDate} />
            <VisualField label="Total" value={expense.total} />
            <VisualField label="Saldo" value={expense.balance} />
          </div>
          <p className="activity-meta" style={{ marginTop: 14 }}>
            {expense.notes}
          </p>
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Aprobacion visual</h2>
            <ReceiptText size={20} />
          </div>
          <div className="grid proof-grid">
            <VisualField label="Solicitado por" value={expense.requestedBy} />
            <VisualField label="Estado" value={expense.approvalStatus} />
            <VisualField label="Adjuntos" value="Placeholder sin archivo" />
            <VisualField label="Pago" value="Deshabilitado en V0.10" />
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <h2 className="card-title">Partidas de compra</h2>
          <FileText size={20} />
        </div>
        <div className="responsive-table">
          <div className="table-header expense-items-grid">
            <span>Descripcion</span>
            <span>Cantidad</span>
            <span>Importe</span>
          </div>
          {expense.items.map((item) => (
            <article className="table-row expense-items-grid" key={item.purchaseItemId}>
              <strong>{item.description}</strong>
              <span>{item.quantity}</span>
              <strong>{item.amount}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="worker-card" style={{ marginTop: 18 }}>
        <h2 className="card-title">Limites de fase</h2>
        <p className="activity-meta">
          Aprobar, pagar, adjuntar factura, contabilizar y relacionar documentos reales queda para fases funcionales.
        </p>
      </section>
    </>
  );
}
