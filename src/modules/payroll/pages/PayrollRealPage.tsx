import { Banknote, CalendarDays, CheckCircle2, Clock3, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthenticatedSession } from "../../../app/auth/authClient";
import { BasicModal } from "../../../shared/components/BasicModal";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { createPayrollPayment, listPayrollWorkers, updatePayrollWorkerSettings, type PayrollPayment, type PayrollWorker } from "../api/payrollClient";

type PayrollRealPageProps = {
  session: AuthenticatedSession;
};

type ActivePanel = "settings" | "payment" | null;

export function PayrollRealPage({ session }: PayrollRealPageProps) {
  const [workers, setWorkers] = useState<PayrollWorker[]>([]);
  const [payments, setPayments] = useState<PayrollPayment[]>([]);
  const [summary, setSummary] = useState({ workers: 0, pendingWorkers: 0, pendingHours: 0, pendingAmount: 0, currency: "USD" });
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [selectedWorker, setSelectedWorker] = useState<PayrollWorker | null>(null);
  const [periodStart, setPeriodStart] = useState(defaultPeriodStart());
  const [periodEnd, setPeriodEnd] = useState(today());
  const [settingsForm, setSettingsForm] = useState({ payType: "hourly", hourlyRate: "0", dailyRate: "0", paymentFrequency: "weekly", currency: "USD", maxDailyPreset: "8", maxDailyHours: "8" });
  const [paymentNotes, setPaymentNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(options: { preserveMessage?: boolean } = {}) {
    setLoading(true);
    if (!options.preserveMessage) {
      setMessage(null);
    }
    try {
      const result = await listPayrollWorkers(session.sessionToken, { periodStart, periodEnd });
      setWorkers(result.items);
      setPayments(result.payments);
      setSummary(result.summary);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar nomina.");
    } finally {
      setLoading(false);
    }
  }

  function openSettings(worker: PayrollWorker) {
    setSelectedWorker(worker);
    setSettingsForm({
      payType: worker.payType,
      hourlyRate: String(worker.hourlyRate || 0),
      dailyRate: String(worker.dailyRate || 0),
      paymentFrequency: worker.paymentFrequency,
      currency: worker.currency,
      maxDailyPreset: ["8", "10", "12"].includes(String(worker.maxDailyHours || 8)) ? String(worker.maxDailyHours || 8) : "custom",
      maxDailyHours: String(worker.maxDailyHours || 8),
    });
    setActivePanel("settings");
  }

  function openPayment(worker: PayrollWorker) {
    setSelectedWorker(worker);
    setPaymentNotes("");
    setActivePanel("payment");
  }

  async function saveSettings() {
    if (!selectedWorker) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updatePayrollWorkerSettings(session.sessionToken, selectedWorker.workerId, {
        payType: settingsForm.payType as PayrollWorker["payType"],
        hourlyRate: Number(settingsForm.hourlyRate || 0),
        dailyRate: Number(settingsForm.dailyRate || 0),
        paymentFrequency: settingsForm.paymentFrequency as PayrollWorker["paymentFrequency"],
        currency: settingsForm.currency as PayrollWorker["currency"],
        maxDailySeconds: Math.round(Number(settingsForm.maxDailyHours || 8) * 3600),
      });
      setMessage("Configuracion de nomina guardada.");
      setActivePanel(null);
      dispatchDataChanged("payroll");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la configuracion.");
    } finally {
      setSaving(false);
    }
  }

  async function payWorker() {
    if (!selectedWorker) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await createPayrollPayment(session.sessionToken, selectedWorker.workerId, { periodStart, periodEnd, notes: paymentNotes });
      setMessage("Nomina pagada y registrada como egreso en Finanzas.");
      setActivePanel(null);
      dispatchDataChanged("payroll");
      dispatchDataChanged("finance");
      dispatchDataChanged("attendance");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar el pago.");
    } finally {
      setSaving(false);
    }
  }

  const selectedPreview = useMemo(() => workers.find((worker) => worker.workerId === selectedWorker?.workerId) || selectedWorker, [selectedWorker, workers]);

  return (
    <section className="production-module-content">
      <PageHeader
        eyebrow="Nomina operacional"
        title="Nomina"
        description="Calcula horas cerradas, descuenta descansos y registra pagos como egresos de empresa."
        actions={
          <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>
            Actualizar
          </Button>
        }
      />

      {message ? <p className="login-notice">{message}</p> : null}

      <section className="card">
        <div className="card-title-row">
          <h2 className="card-title">Periodo de pago</h2>
          <StatusBadge label={summary.currency} tone="info" />
        </div>
        <div className="form-grid">
          <label className="form-control">
            <span>Desde</span>
            <input className="input" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
          </label>
          <label className="form-control">
            <span>Hasta</span>
            <input className="input" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
          </label>
          <div className="form-control">
            <span>Accion</span>
            <Button variant="primary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>
              Recalcular periodo
            </Button>
          </div>
        </div>
      </section>

      <section className="grid stats-grid crm-real-stats">
        <SummaryCard label="Trabajadores" value={loading && !summary.workers ? "Cargando" : summary.workers} icon={<Clock3 size={20} />} />
        <SummaryCard label="Con saldo" value={summary.pendingWorkers} icon={<CalendarDays size={20} />} />
        <SummaryCard label="Horas por pagar" value={`${summary.pendingHours.toFixed(2)} h`} icon={<Clock3 size={20} />} />
        <SummaryCard label="Total por pagar" value={formatMoney(summary.pendingAmount, summary.currency)} icon={<Banknote size={20} />} />
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2 className="card-title">Trabajadores activos</h2>
          <StatusBadge label={`${workers.length} registros`} tone="info" />
        </div>
        {!loading && workers.length === 0 ? <EmptyState title="Sin trabajadores" description="Crea trabajadores activos para calcular nomina." /> : null}
        <div className="responsive-table">
          {workers.map((worker) => (
            <article className="table-row record-card payroll-record-card" key={worker.workerId}>
              <div className="record-main">
                <div>
                  <p className="record-label">Trabajador</p>
                  <strong>{worker.name}</strong>
                  <span className="activity-meta">{worker.trade || "Sin oficio"} · {worker.email || "Sin usuario ligado"}</span>
                </div>
                <StatusBadge label={frequencyLabel(worker.paymentFrequency)} tone="info" />
              </div>

              <div className="record-field highlight">
                <span>Horas por pagar</span>
                <strong>{worker.pendingHours.toFixed(2)} h</strong>
              </div>
              <div className="record-field">
                <span>Descansos descontados</span>
                <strong>{formatHours(worker.pendingBreakSeconds)} h</strong>
                <span className="activity-meta">{worker.pendingEntries} jornadas cerradas</span>
              </div>
              <div className="record-field highlight">
                <span>Total por pagar</span>
                <strong>{formatMoney(worker.pendingAmount, worker.currency)}</strong>
              </div>
              <div className="record-field">
                <span>Tarifa configurada</span>
                <strong>{worker.payType === "daily" ? `${formatMoney(worker.dailyRate, worker.currency)} / dia` : `${formatMoney(worker.hourlyRate, worker.currency)} / hora`}</strong>
                <span className="activity-meta">{worker.payType === "daily" ? "Pago por dia" : "Pago por hora"}</span>
              </div>
              <div className="record-field">
                <span>Maximo diario</span>
                <strong>{formatDailyLimit(worker.maxDailySeconds)}</strong>
                <span className="activity-meta">Tope automatico para jornadas olvidadas</span>
              </div>
              <div className="segmented-actions record-actions">
                <Button variant="secondary" type="button" icon={<Save size={16} />} onClick={() => openSettings(worker)}>
                  Tarifa
                </Button>
                <Button variant="primary" type="button" icon={<CheckCircle2 size={16} />} onClick={() => openPayment(worker)} disabled={worker.pendingEntries === 0 || worker.pendingAmount <= 0}>
                  Pagar
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-title-row">
          <h2 className="card-title">Historial de pagos</h2>
          <StatusBadge label={`${payments.length} pagos`} tone="success" />
        </div>
        {payments.length === 0 ? <EmptyState title="Sin pagos registrados" description="Cuando pagues nomina apareceran los pagos y el movimiento financiero relacionado." /> : null}
        <div className="responsive-table">
          {payments.map((payment) => (
            <article className="table-row record-card payroll-payment-record-card" key={payment.payrollPaymentId}>
              <div className="record-main">
                <div>
                  <p className="record-label">Trabajador</p>
                  <strong>{payment.workerName}</strong>
                  <span className="activity-meta">{payment.periodStart} a {payment.periodEnd}</span>
                </div>
                <StatusBadge label="Egreso creado" tone={payment.financeTransactionId ? "success" : "warning"} />
              </div>
              <div className="record-field">
                <span>Horas pagadas</span>
                <strong>{payment.payableHours.toFixed(2)} h</strong>
              </div>
              <div className="record-field highlight">
                <span>Total pagado</span>
                <strong>{formatMoney(payment.amount, payment.currency)}</strong>
              </div>
              <div className="record-field">
                <span>Fecha de pago</span>
                <strong>{formatDateTime(payment.paidAt)}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <BasicModal title="Configurar tarifa" open={activePanel === "settings"} onClose={() => setActivePanel(null)} size="wide" footer={null}>
        <div className="card-title-row">
          <strong>{selectedWorker?.name}</strong>
          <StatusBadge label="Solo esta empresa" tone="success" />
        </div>
        <div className="form-grid">
          <label className="form-control">
            <span>Tipo de pago</span>
            <select className="select" value={settingsForm.payType} onChange={(event) => setSettingsForm({ ...settingsForm, payType: event.target.value })}>
              <option value="hourly">Por hora</option>
              <option value="daily">Por dia</option>
            </select>
          </label>
          <label className="form-control">
            <span>Tarifa por hora</span>
            <input className="input" inputMode="decimal" value={settingsForm.hourlyRate} onChange={(event) => setSettingsForm({ ...settingsForm, hourlyRate: event.target.value })} />
          </label>
          <label className="form-control">
            <span>Tarifa por dia</span>
            <input className="input" inputMode="decimal" value={settingsForm.dailyRate} onChange={(event) => setSettingsForm({ ...settingsForm, dailyRate: event.target.value })} />
          </label>
          <label className="form-control">
            <span>Frecuencia</span>
            <select className="select" value={settingsForm.paymentFrequency} onChange={(event) => setSettingsForm({ ...settingsForm, paymentFrequency: event.target.value })}>
              <option value="daily">Diaria</option>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
              <option value="monthly">Mensual</option>
            </select>
          </label>
          <label className="form-control">
            <span>Moneda</span>
            <select className="select" value={settingsForm.currency} onChange={(event) => setSettingsForm({ ...settingsForm, currency: event.target.value })}>
              <option value="USD">USD</option>
              <option value="COP">COP</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label className="form-control">
            <span>Maximo de horas por dia</span>
            <select
              className="select"
              value={settingsForm.maxDailyPreset}
              onChange={(event) => {
                const value = event.target.value;
                setSettingsForm({ ...settingsForm, maxDailyPreset: value, maxDailyHours: value === "custom" ? settingsForm.maxDailyHours : value });
              }}
            >
              <option value="8">8 horas</option>
              <option value="10">10 horas</option>
              <option value="12">12 horas</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
          {settingsForm.maxDailyPreset === "custom" ? (
            <label className="form-control">
              <span>Horas maximas personalizadas</span>
              <input className="input" inputMode="decimal" value={settingsForm.maxDailyHours} onChange={(event) => setSettingsForm({ ...settingsForm, maxDailyHours: event.target.value })} placeholder="Ejemplo: 9.5" />
            </label>
          ) : null}
        </div>
        <p className="login-security-note">
          Si una jornada queda abierta por olvido, el sistema detiene el tiempo pagable en este limite y deja alerta para revision del administrador.
        </p>
        <div className="segmented-actions modal-form-actions">
          <Button variant="primary" type="button" icon={<Save size={16} />} onClick={() => void saveSettings()} disabled={saving}>
            Guardar tarifa
          </Button>
          <Button variant="secondary" type="button" onClick={() => setActivePanel(null)} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </BasicModal>

      <BasicModal title="Pagar nomina" open={activePanel === "payment"} onClose={() => setActivePanel(null)} size="wide" footer={null}>
        <div className="activity-list">
          <div className="card-title-row">
            <div>
              <strong>{selectedPreview?.name}</strong>
              <span className="activity-meta">{periodStart} a {periodEnd}</span>
            </div>
            <StatusBadge label={selectedPreview ? formatMoney(selectedPreview.pendingAmount, selectedPreview.currency) : "0"} tone="warning" />
          </div>
          <p className="login-security-note">
            Al confirmar, las jornadas cerradas de este periodo quedaran marcadas como pagadas y se creara un egreso automatico en Finanzas. No se eliminan registros.
          </p>
          <label className="form-control">
            <span>Notas opcionales</span>
            <textarea className="input" rows={3} value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} />
          </label>
        </div>
        <div className="segmented-actions modal-form-actions">
          <Button variant="primary" type="button" icon={<CheckCircle2 size={16} />} onClick={() => void payWorker()} disabled={saving || !selectedPreview || selectedPreview.pendingAmount <= 0}>
            Confirmar pago
          </Button>
          <Button variant="secondary" type="button" onClick={() => setActivePanel(null)} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </BasicModal>
    </section>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
        </div>
        <span className="stat-icon info">{icon}</span>
      </div>
      <span className="stat-note">Calculado desde jornadas cerradas del tenant</span>
    </article>
  );
}

function defaultPeriodStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatHours(seconds: number) {
  return (Math.max(0, seconds) / 3600).toFixed(2);
}

function formatDailyLimit(seconds: number) {
  const hours = Math.max(0, Number(seconds || 0) / 3600);
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 2)} h`;
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(Number(amount || 0));
}

function formatDateTime(value: string) {
  return value ? new Date(value).toLocaleString() : "";
}

function frequencyLabel(value: PayrollWorker["paymentFrequency"]) {
  const labels = {
    daily: "Diaria",
    weekly: "Semanal",
    biweekly: "Quincenal",
    monthly: "Mensual",
  };
  return labels[value] || value;
}

function dispatchDataChanged(module: string) {
  window.dispatchEvent(new CustomEvent("constriqo:data-changed", { detail: { module } }));
}
