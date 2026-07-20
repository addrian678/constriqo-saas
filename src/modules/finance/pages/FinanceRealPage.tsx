import { BadgeDollarSign, Banknote, CheckCircle2, Landmark, Plus, RefreshCw, Save, TrendingUp, WalletCards } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { AuthenticatedSession } from "../../../app/auth/authClient";
import { Button } from "../../../shared/components/Button";
import { BasicModal } from "../../../shared/components/BasicModal";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { listJobs, type JobSummary } from "../../jobs/api/jobClient";
import {
  approveExpense,
  correctManualTransaction,
  createExpense,
  createManualTransaction,
  createVendor,
  getCachedFinanceDashboard,
  getFinanceDashboard,
  listExpenses,
  listVendors,
  recordExpensePayment,
  type Expense,
  type ExpenseInput,
  type FinanceDashboard,
  type ManualTransactionInput,
  type Vendor,
} from "../api/financeClient";

type FinanceRealPageProps = {
  session: AuthenticatedSession;
};

type FinancePeriodKey = "today" | "week" | "month" | "year";

const initialExpense: ExpenseInput = {
  vendorName: "",
  jobId: "",
  category: "",
  description: "",
  currency: "USD",
  totalAmount: 0,
  taxAmount: 0,
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
};

const initialManualTransaction: ManualTransactionInput = {
  accountType: "income",
  transactionType: "income",
  direction: "credit",
  amount: 0,
  currency: "USD",
  occurredAt: new Date().toISOString(),
  description: "",
};

const expenseCategories = ["Materiales", "Mano de obra", "Equipos", "Subcontratistas", "Permisos y tasas", "Transporte", "Gestion de residuos", "Gastos generales", "Servicios", "Otro"];

const movementPresets: Record<string, Pick<ManualTransactionInput, "accountType" | "transactionType" | "direction" | "description">> = {
  income: { accountType: "income", transactionType: "income", direction: "credit", description: "Ingreso manual" },
  expense: { accountType: "expense", transactionType: "expense_accrual", direction: "debit", description: "Egreso manual" },
  asset: { accountType: "asset", transactionType: "asset_registration", direction: "debit", description: "Registro de activo" },
  liability: { accountType: "liability", transactionType: "liability_registration", direction: "credit", description: "Registro de pasivo" },
  advance: { accountType: "cash", transactionType: "job_advance", direction: "debit", description: "Anticipo de obra" },
};

const statusLabels: Record<Expense["status"], string> = {
  draft: "Borrador",
  registered: "Registrado",
  approved: "Aprobado",
  paid: "Pagado",
  void: "Anulado",
};

const statusTone: Record<Expense["status"], "neutral" | "info" | "warning" | "success" | "danger"> = {
  draft: "neutral",
  registered: "info",
  approved: "success",
  paid: "success",
  void: "danger",
};

export function FinanceRealPage({ session }: FinanceRealPageProps) {
  const [dashboard, setDashboard] = useState<FinanceDashboard | null>(() => getCachedFinanceDashboard(session.sessionToken));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [expenseForm, setExpenseForm] = useState<ExpenseInput>(initialExpense);
  const [vendorForm, setVendorForm] = useState({ name: "", category: "", phone: "", email: "" });
  const [manualForm, setManualForm] = useState<ManualTransactionInput>(initialManualTransaction);
  const [activePanel, setActivePanel] = useState<"vendor" | "expense" | "transaction" | "correction" | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<FinanceDashboard["transactions"][number] | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<FinancePeriodKey>("today");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const currency = dashboard?.currency || "USD";
  const visiblePeriod = selectedMonth
    ? dashboard?.monthlyHistory?.find((item) => item.month === selectedMonth) || null
    : dashboard ? dashboard.periods[selectedPeriod] : null;
  const sortedExpenses = useMemo(() => expenses.slice(0, 12), [expenses]);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(options: { preserveMessage?: boolean } = {}) {
    setLoading(true);
    if (!options.preserveMessage) {
      setMessage(null);
    }
    try {
      const [nextDashboard, expenseResult, vendorResult, jobResult] = await Promise.all([
        getFinanceDashboard(session.sessionToken),
        listExpenses(session.sessionToken),
        listVendors(session.sessionToken),
        listJobs(session.sessionToken).catch(() => ({ items: [] as JobSummary[], summary: {} })),
      ]);
      setDashboard(nextDashboard);
      setExpenses(expenseResult.items);
      setVendors(vendorResult);
      setJobs(jobResult.items);
      setExpenseForm((current) => ({ ...current, currency: nextDashboard.currency }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar finanzas.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateVendor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const vendor = await createVendor(session.sessionToken, vendorForm);
      setVendorForm({ name: "", category: "", phone: "", email: "" });
      setExpenseForm({ ...expenseForm, vendorId: vendor.vendorId, vendorName: vendor.name });
      setActivePanel(null);
      setMessage("Proveedor creado o actualizado.");
      dispatchDataChanged("finance");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear proveedor.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await createExpense(session.sessionToken, {
        ...expenseForm,
        vendorId: expenseForm.vendorId || null,
        jobId: expenseForm.jobId || null,
        totalAmount: Number(expenseForm.totalAmount),
        taxAmount: Number(expenseForm.taxAmount || 0),
      });
      setExpenseForm({ ...initialExpense, currency });
      setActivePanel(null);
      setMessage("Gasto registrado y contabilizado en ledger.");
      dispatchDataChanged("finance");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear gasto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateManualTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await createManualTransaction(session.sessionToken, {
        ...manualForm,
        amount: Number(manualForm.amount),
        currency,
      });
      setManualForm({ ...initialManualTransaction, currency });
      setActivePanel(null);
      setMessage("Movimiento contable registrado en ledger. El historial no se borra.");
      dispatchDataChanged("finance");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar el movimiento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCorrectManualTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!correctionTarget) {
      setMessage("Selecciona un movimiento para corregir.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await correctManualTransaction(session.sessionToken, correctionTarget.transactionId, {
        ...manualForm,
        amount: Number(manualForm.amount),
        currency,
      });
      setManualForm({ ...initialManualTransaction, currency });
      setCorrectionTarget(null);
      setActivePanel(null);
      setMessage("Movimiento corregido: se registro reverso, nuevo movimiento e historial de auditoria.");
      dispatchDataChanged("finance");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo corregir el movimiento.");
    } finally {
      setSaving(false);
    }
  }

  function applyMovementType(kind: keyof typeof movementPresets) {
    setManualForm({
      ...manualForm,
      ...movementPresets[kind],
      currency,
      occurredAt: manualForm.occurredAt || new Date().toISOString(),
    });
    setActivePanel((current) => (current === "correction" ? "correction" : "transaction"));
  }

  function openCorrection(transaction: FinanceDashboard["transactions"][number]) {
    setCorrectionTarget(transaction);
    const kind: keyof typeof movementPresets = transaction.transactionType === "expense_accrual" ? "expense" : transaction.transactionType === "asset_registration" ? "asset" : transaction.transactionType === "liability_registration" ? "liability" : transaction.transactionType === "job_advance" ? "advance" : "income";
    setManualForm({
      ...initialManualTransaction,
      ...movementPresets[kind],
      amount: transaction.amount,
      currency,
      occurredAt: new Date().toISOString(),
      description: `Correccion de ${transaction.description || transaction.transactionType}`,
    });
    setActivePanel("correction");
  }

  async function handleApprove(expense: Expense) {
    setSaving(true);
    setMessage(null);
    try {
      await approveExpense(session.sessionToken, expense.expenseId);
      setMessage("Gasto aprobado.");
      dispatchDataChanged("finance");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo aprobar gasto.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePay(expense: Expense) {
    setSaving(true);
    setMessage(null);
    try {
      await recordExpensePayment(session.sessionToken, expense.expenseId, { amount: expense.balanceAmount, method: "cash" });
      setMessage("Pago registrado y reflejado en caja.");
      dispatchDataChanged("finance");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar pago.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="production-module-content">
      <PageHeader
        eyebrow="Finanzas reales F9.1"
        title="Finanzas y gastos"
        description="Dashboard calculado desde facturas, gastos, activos, pasivos y transacciones reales por tenant."
        actions={
          <div className="segmented-actions">
            <Button variant="primary" type="button" icon={<Plus size={16} />} onClick={() => {
              setCorrectionTarget(null);
              setManualForm({ ...initialManualTransaction, currency });
              setActivePanel(activePanel === "transaction" ? null : "transaction");
            }}>Agregar movimiento contable</Button>
            <Button variant="secondary" type="button" icon={<Plus size={16} />} onClick={() => setActivePanel(activePanel === "vendor" ? null : "vendor")}>Proveedor</Button>
            <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>Actualizar</Button>
          </div>
        }
      />

      {message ? <p className="login-notice">{message}</p> : null}

      <section className="grid stats-grid crm-real-stats">
        <SummaryCard label="Ingresos mes" value={dashboard ? formatMoney(dashboard.summary.income, currency) : "Cargando"} icon={<BadgeDollarSign size={20} />} note="Mes calendario actual" />
        <SummaryCard label="Egresos mes" value={dashboard ? formatMoney(dashboard.summary.expenses, currency) : "Cargando"} icon={<WalletCards size={20} />} note="Mes calendario actual" />
        <SummaryCard label="Utilidad mes" value={dashboard ? formatMoney(dashboard.summary.netProfit, currency) : "Cargando"} icon={<TrendingUp size={20} />} note="Mes calendario actual" />
        <SummaryCard label="Patrimonio" value={dashboard ? formatMoney(dashboard.summary.equity, currency) : "Cargando"} icon={<Landmark size={20} />} />
      </section>

      <BasicModal title="Proveedor" open={activePanel === "vendor"} onClose={() => setActivePanel(null)} size="wide" footer={null}>
        <form className="auth-form" onSubmit={handleCreateVendor}>
          <div className="card-title-row">
            <span className="activity-meta">Proveedor del tenant para gastos, compras y costos de obra.</span>
            <StatusBadge label={`${vendors.length} activos`} tone="info" />
          </div>
          <label className="form-control">
            <span>Nombre</span>
            <input className="input" value={vendorForm.name} onChange={(event) => setVendorForm({ ...vendorForm, name: event.target.value })} required />
          </label>
          <div className="grid proof-grid">
            <label className="form-control">
              <span>Categoria</span>
              <input className="input" value={vendorForm.category} onChange={(event) => setVendorForm({ ...vendorForm, category: event.target.value })} />
            </label>
            <label className="form-control">
              <span>Telefono</span>
              <input className="input" value={vendorForm.phone} onChange={(event) => setVendorForm({ ...vendorForm, phone: event.target.value })} />
            </label>
          </div>
          <Button variant="primary" type="submit" icon={<Plus size={16} />} disabled={saving}>Guardar proveedor</Button>
        </form>
      </BasicModal>

      <BasicModal title={activePanel === "correction" ? "Corregir movimiento" : "Movimiento contable"} open={activePanel === "transaction" || activePanel === "correction"} onClose={() => setActivePanel(null)} size="wide" footer={null}>
        <form className="auth-form" onSubmit={activePanel === "correction" ? handleCorrectManualTransaction : handleCreateManualTransaction}>
          <div className="card-title-row">
            <span className="activity-meta">El historial no se borra: las correcciones generan reverso y nuevo registro.</span>
            <StatusBadge label={activePanel === "correction" ? "Reverso + nuevo registro" : "Historial no borrable"} tone="success" />
          </div>
          {activePanel === "correction" && correctionTarget ? (
            <p className="activity-meta">
              Movimiento original: {correctionTarget.description || correctionTarget.transactionType} · {formatMoney(correctionTarget.amount, correctionTarget.currency)}
            </p>
          ) : null}
          <div className="grid proof-grid">
            <label className="form-control">
              <span>Tipo de movimiento</span>
              <select
                className="select"
                value={manualForm.transactionType === "expense_accrual" ? "expense" : manualForm.transactionType === "asset_registration" ? "asset" : manualForm.transactionType === "liability_registration" ? "liability" : manualForm.transactionType === "job_advance" ? "advance" : "income"}
                onChange={(event) => applyMovementType(event.target.value as keyof typeof movementPresets)}
              >
                <option value="income">Ingreso</option>
                <option value="expense">Egreso / gasto</option>
                <option value="asset">Activo</option>
                <option value="liability">Pasivo</option>
                <option value="advance">Anticipo de obra</option>
              </select>
            </label>
            <label className="form-control">
              <span>Naturaleza contable</span>
              <select className="select" value={manualForm.direction} onChange={(event) => setManualForm({ ...manualForm, direction: event.target.value as ManualTransactionInput["direction"] })}>
                <option value="debit">Debito</option>
                <option value="credit">Credito</option>
              </select>
            </label>
            <label className="form-control">
              <span>Importe</span>
              <input className="input" type="number" min="0" step="0.01" value={manualForm.amount || ""} onChange={(event) => setManualForm({ ...manualForm, amount: Number(event.target.value) })} required />
            </label>
            <label className="form-control">
              <span>Fecha</span>
              <input className="input" type="datetime-local" value={toLocalDateTime(manualForm.occurredAt)} onChange={(event) => setManualForm({ ...manualForm, occurredAt: new Date(event.target.value).toISOString() })} />
            </label>
          </div>
          <label className="form-control">
            <span>Descripcion</span>
            <input className="input" value={manualForm.description || ""} onChange={(event) => setManualForm({ ...manualForm, description: event.target.value })} required />
          </label>
          <Button variant="primary" type="submit" icon={<Save size={16} />} disabled={saving}>
            {activePanel === "correction" ? "Guardar correccion" : "Registrar movimiento"}
          </Button>
        </form>
      </BasicModal>

      <section className="grid crm-real-grid">
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
            <h2 className="card-title">Balance acumulado</h2>
            <StatusBadge label="Historico" tone="info" />
          </div>
          <div className="grid proof-grid">
            <SummaryCard label="Ingresos acumulados" value={dashboard ? formatMoney(dashboard.summary.accumulatedIncome || 0, currency) : "Cargando"} icon={<BadgeDollarSign size={18} />} />
            <SummaryCard label="Egresos acumulados" value={dashboard ? formatMoney(dashboard.summary.accumulatedExpenses || 0, currency) : "Cargando"} icon={<WalletCards size={18} />} />
            <SummaryCard label="Utilidad acumulada" value={dashboard ? formatMoney(dashboard.summary.accumulatedNetProfit || 0, currency) : "Cargando"} icon={<TrendingUp size={18} />} />
            <SummaryCard label="Patrimonio actual" value={dashboard ? formatMoney(dashboard.summary.equity, currency) : "Cargando"} icon={<Landmark size={18} />} />
          </div>
        </div>
      </section>

      <BasicModal title="Registrar gasto" open={activePanel === "expense"} onClose={() => setActivePanel(null)} size="wide" footer={null}>
        <form className="auth-form" onSubmit={handleCreateExpense}>
          <div className="card-title-row">
            <span className="activity-meta">Un gasto se registra como egreso y queda reflejado en ledger.</span>
            <StatusBadge label="Ledger" tone="success" />
          </div>
          <label className="form-control">
            <span>Proveedor</span>
            <select
              className="select"
              value={expenseForm.vendorId || ""}
              onChange={(event) => {
                const vendor = vendors.find((item) => item.vendorId === event.target.value);
                setExpenseForm({ ...expenseForm, vendorId: vendor?.vendorId || "", vendorName: vendor?.name || "" });
              }}
            >
              <option value="">Nuevo por nombre</option>
              {vendors.map((vendor) => (
                <option value={vendor.vendorId} key={vendor.vendorId}>{vendor.name}</option>
              ))}
            </select>
          </label>
          {!expenseForm.vendorId ? (
            <label className="form-control">
              <span>Nombre proveedor</span>
              <input className="input" value={expenseForm.vendorName} onChange={(event) => setExpenseForm({ ...expenseForm, vendorName: event.target.value })} required />
            </label>
          ) : null}
          <div className="grid proof-grid">
            <label className="form-control">
              <span>Obra opcional</span>
              <select className="select" value={expenseForm.jobId || ""} onChange={(event) => setExpenseForm({ ...expenseForm, jobId: event.target.value })}>
                <option value="">Sin obra</option>
                {jobs.map((job) => (
                  <option value={job.jobId} key={job.jobId}>{job.jobNumber} - {job.title}</option>
                ))}
              </select>
            </label>
            <label className="form-control">
              <span>Categoria</span>
              <select className="select" value={expenseForm.category} onChange={(event) => setExpenseForm({ ...expenseForm, category: event.target.value })} required>
                <option value="">Seleccionar categoria</option>
                {expenseCategories.map((category) => <option value={category} key={category}>{category}</option>)}
              </select>
            </label>
            <label className="form-control">
              <span>Importe</span>
              <input className="input" type="number" step="0.01" min="0" value={expenseForm.totalAmount || ""} onChange={(event) => setExpenseForm({ ...expenseForm, totalAmount: Number(event.target.value) })} required />
            </label>
            <label className="form-control">
              <span>Impuesto incluido</span>
              <input className="input" type="number" step="0.01" min="0" value={expenseForm.taxAmount || ""} onChange={(event) => setExpenseForm({ ...expenseForm, taxAmount: Number(event.target.value) })} />
            </label>
            <label className="form-control">
              <span>Fecha</span>
              <input className="input" type="date" value={expenseForm.issueDate || ""} onChange={(event) => setExpenseForm({ ...expenseForm, issueDate: event.target.value })} />
            </label>
            <label className="form-control">
              <span>Vence</span>
              <input className="input" type="date" value={expenseForm.dueDate || ""} onChange={(event) => setExpenseForm({ ...expenseForm, dueDate: event.target.value })} />
            </label>
          </div>
          <label className="form-control">
            <span>Descripcion</span>
            <textarea className="input crm-textarea" value={expenseForm.description || ""} onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })} />
          </label>
          <Button variant="primary" type="submit" icon={<Save size={16} />} disabled={saving}>Registrar gasto</Button>
        </form>
      </BasicModal>

      <section className="grid crm-real-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Gastos recientes</h2>
            <StatusBadge label={loading ? "Cargando" : `${expenses.length} registros`} tone="info" />
          </div>
          {!loading && expenses.length === 0 ? <EmptyState title="Sin gastos" description="Registra el primer gasto real. No se cargan datos demo." /> : null}
          <div className="responsive-table">
            {sortedExpenses.map((expense) => (
              <article className="table-row expenses-table-grid" key={expense.expenseId}>
                <div>
                  <strong>{expense.expenseNumber}</strong>
                  <span className="activity-meta">{expense.category}</span>
                </div>
                <div>
                  <strong>{expense.vendorName}</strong>
                  <span className="activity-meta">{expense.jobTitle || "Sin obra"}</span>
                </div>
                <StatusBadge label={statusLabels[expense.status]} tone={statusTone[expense.status]} />
                <strong>{formatMoney(expense.balanceAmount, expense.currency)}</strong>
                <div className="segmented-actions">
                  <Button variant="secondary" type="button" icon={<CheckCircle2 size={16} />} onClick={() => void handleApprove(expense)} disabled={saving || expense.status === "approved" || expense.status === "paid"}>
                    Aprobar
                  </Button>
                  <Button variant="secondary" type="button" icon={<Banknote size={16} />} onClick={() => void handlePay(expense)} disabled={saving || expense.balanceAmount <= 0}>
                    Pagar
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid two-column crm-real-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Movimientos ledger</h2>
            <StatusBadge label="PostgreSQL" tone="success" />
          </div>
          <div className="responsive-table">
            {dashboard?.transactions.map((transaction) => (
              <article className="table-row finance-table-grid" key={transaction.transactionId}>
                <span>{new Date(transaction.occurredAt).toLocaleDateString()}</span>
                <div>
                  <strong>{transaction.description || transaction.transactionType}</strong>
                  <span className="activity-meta">{transaction.accountName}</span>
                </div>
                <StatusBadge label={transaction.direction || transaction.transactionType} tone={transaction.direction === "debit" ? "info" : "warning"} />
                <span>{transaction.transactionType}</span>
                <div className="segmented-actions">
                  <strong>{formatMoney(transaction.amount, transaction.currency)}</strong>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => openCorrection(transaction)}
                    disabled={saving || transaction.status === "corrected" || Boolean(transaction.relatedEntityType && transaction.relatedEntityType !== "manual" && transaction.relatedEntityType !== "financial_correction")}
                  >
                    Corregir
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Rentabilidad por obra</h2>
            <StatusBadge label="Cotizado vs real despues" tone="warning" />
          </div>
          <div className="responsive-table">
            {dashboard?.jobProfitability.map((item) => (
              <article className="table-row profitability-table-grid" key={item.jobId}>
                <strong>{item.jobNumber} - {item.title}</strong>
                <span>{formatMoney(item.income, currency)}</span>
                <span>{formatMoney(item.expenses, currency)}</span>
                <strong>{formatMoney(item.margin, currency)}</strong>
                <StatusBadge label={item.margin >= 0 ? "Margen positivo" : "Perdida"} tone={item.margin >= 0 ? "success" : "danger"} />
              </article>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

function SummaryCard({ icon, label, value, note = "Calculado desde datos reales del tenant" }: { icon: ReactNode; label: string; value: string; note?: string }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
        </div>
        <span className="stat-icon info">{icon}</span>
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

function toLocalDateTime(value?: string) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 16);
}

function dispatchDataChanged(module: string) {
  window.dispatchEvent(new CustomEvent("constriqo:data-changed", { detail: { module } }));
}
