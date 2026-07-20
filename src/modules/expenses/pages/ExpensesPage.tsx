import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClockAlert, PackageCheck, ReceiptText, Search, Truck } from "lucide-react";
import { jobs } from "../../jobs/mock-data/jobsData";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { expenses, payablesSummary, vendors, type ExpenseStatus } from "../mock-data/expensesData";

const expenseTone: Record<ExpenseStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Borrador: "neutral",
  "Pendiente de aprobacion": "warning",
  "Aprobado visualmente": "success",
  Vencido: "danger",
  "Pagado visualmente": "info",
};

type ExpensesPageProps = {
  basePath: "/admin/gastos" | "/manager/gastos";
  roleLabel: "Administrador" | "Gestor de empresa";
};

export function ExpensesPage({ basePath, roleLabel }: ExpensesPageProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ExpenseStatus | "Todos">("Todos");

  const filteredExpenses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return expenses.filter((expense) => {
      const vendor = vendors.find((item) => item.vendorId === expense.vendorId);
      const job = jobs.find((item) => item.jobId === expense.jobId);
      const matchesQuery =
        !normalizedQuery ||
        [expense.billNumber, expense.category, expense.status, vendor?.name || "", job?.title || ""].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      const matchesStatus = status === "Todos" || expense.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status]);

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - V0.10`}
        title="Gastos y compras"
        description="Proveedores, compras, vencimientos, aprobaciones y cuentas por pagar visuales. Sin pagos reales ni contabilidad."
      />

      <section className="grid stats-grid">
        <StatCard label="Por pagar" value={payablesSummary.open} note="Saldo visual" tone="warning" icon={ReceiptText} />
        <StatCard label="Vencido" value={payablesSummary.overdue} note="Sin recordatorio real" tone="danger" icon={ClockAlert} />
        <StatCard label="Borradores" value={payablesSummary.drafts} note="Sin orden real" tone="info" icon={PackageCheck} />
        <StatCard label="Proveedores" value={String(vendors.length)} note="Directorio visual" tone="positive" icon={Truck} />
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Listado de gastos</h2>
              <p className="activity-meta">Los saldos son visuales y no alimentan contabilidad real.</p>
            </div>
            <StatusBadge label="V0.10 visual" tone="info" />
          </div>
          <div className="filters-row">
            <label className="search-box crm-search">
              <Search size={18} />
              <input
                aria-label="Buscar gastos"
                placeholder="Buscar por proveedor, obra, categoria o estado"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="form-control filter-control">
              <span className="visual-field-label">Estado</span>
              <select className="select" value={status} onChange={(event) => setStatus(event.target.value as ExpenseStatus | "Todos")}>
                <option>Todos</option>
                <option>Borrador</option>
                <option>Pendiente de aprobacion</option>
                <option>Aprobado visualmente</option>
                <option>Vencido</option>
                <option>Pagado visualmente</option>
              </select>
            </label>
          </div>

          {filteredExpenses.length > 0 ? (
            <div className="responsive-table" style={{ marginTop: 16 }}>
              <div className="table-header expenses-table-grid">
                <span>Gasto</span>
                <span>Proveedor</span>
                <span>Estado</span>
                <span>Saldo</span>
                <span>Accion</span>
              </div>
              {filteredExpenses.map((expense) => {
                const vendor = vendors.find((item) => item.vendorId === expense.vendorId);
                const job = jobs.find((item) => item.jobId === expense.jobId);
                return (
                  <article className="table-row expenses-table-grid" key={expense.expenseId}>
                    <div>
                      <strong>{expense.billNumber}</strong>
                      <p className="activity-meta">{job?.title}</p>
                    </div>
                    <div>
                      <strong>{vendor?.name}</strong>
                      <p className="activity-meta">{expense.category}</p>
                    </div>
                    <StatusBadge label={expense.status} tone={expenseTone[expense.status]} />
                    <strong>{expense.balance}</strong>
                    <Link className="button button-secondary" to={`${basePath}/${expense.expenseId}`}>
                      Ver detalle
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Sin gastos" description="No hay resultados para los filtros actuales." />
          )}
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Proveedores</h2>
            <StatusBadge label="Visual" tone="neutral" />
          </div>
          <div className="grid">
            {vendors.map((vendor) => (
              <article className="alert-card" key={vendor.vendorId}>
                <div className="alert-heading">
                  <h3 className="alert-title">{vendor.name}</h3>
                  <StatusBadge label={vendor.status} tone={vendor.status === "En revision" ? "warning" : "success"} />
                </div>
                <p className="alert-text">{vendor.category} - {vendor.contact} - {vendor.phone}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
