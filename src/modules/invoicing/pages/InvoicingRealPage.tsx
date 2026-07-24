import { Banknote, Download, FileCheck2, FileText, Mail, Plus, Printer, Receipt, RefreshCw, RotateCcw, Save } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { openBlobInDocumentViewer, type AuthenticatedSession } from "../../../app/auth/authClient";
import { saveDocumentToCurrentDevice } from "../../../app/native/nativeCapabilities";
import { Button } from "../../../shared/components/Button";
import { BasicModal } from "../../../shared/components/BasicModal";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { listCrmClients, type CrmClient } from "../../crm/api/crmClient";
import { listEstimates, type EstimateSummary } from "../../estimates/api/estimateClient";
import {
  createInvoice,
  createCreditNote,
  downloadInvoicePdf,
  downloadReceiptPdf,
  getInvoice,
  issueInvoice,
  listInvoices,
  recordInvoicePayment,
  sendInvoiceEmail,
  type Invoice,
  type InvoiceInput,
  type InvoiceItem,
  type InvoicePayment,
  type InvoiceStatusHistory,
} from "../api/invoiceClient";

type InvoicingRealPageProps = {
  session: AuthenticatedSession;
};

const initialInvoice: InvoiceInput = {
  clientId: "",
  estimateId: "",
  title: "",
  currency: "USD",
  countryProfile: "US",
  documentLanguage: "es",
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  items: [{ description: "", quantity: 1, unitCode: "unit", unitPrice: 0, taxAmount: 0 }],
};

const statusLabels: Record<Invoice["status"], string> = {
  draft: "Borrador",
  issued: "Emitida",
  sent: "Enviada",
  partial: "Pago parcial",
  paid: "Pagada",
  overdue: "Vencida",
  void: "Anulada",
};

const statusTone: Record<Invoice["status"], "neutral" | "info" | "warning" | "success" | "danger"> = {
  draft: "neutral",
  issued: "info",
  sent: "info",
  partial: "warning",
  paid: "success",
  overdue: "danger",
  void: "danger",
};

export function InvoicingRealPage({ session }: InvoicingRealPageProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [estimates, setEstimates] = useState<EstimateSummary[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const [selectedPayments, setSelectedPayments] = useState<InvoicePayment[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<InvoiceStatusHistory[]>([]);
  const [form, setForm] = useState<InvoiceInput>(initialInvoice);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [creditReason, setCreditReason] = useState("");
  const [creditAmount, setCreditAmount] = useState(0);
  const [activePanel, setActivePanel] = useState<"create" | "issue" | "payment" | "credit" | null>(null);
  const [pendingInvoice, setPendingInvoice] = useState<Invoice | null>(null);
  const [confirmEstimateInvoice, setConfirmEstimateInvoice] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    method: "bank_transfer",
    receivedAt: new Date().toISOString().slice(0, 16),
    reference: "",
    notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const approvedEstimates = useMemo(() => estimates.filter((estimate) => estimate.status === "approved"), [estimates]);
  const selectedApprovedEstimate = useMemo(
    () => approvedEstimates.find((estimate) => estimate.estimateId === form.estimateId) || null,
    [approvedEstimates, form.estimateId],
  );
  const currency = selectedInvoice?.currency || form.currency || "USD";

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(options: { preserveMessage?: boolean } = {}) {
    setLoading(true);
    if (!options.preserveMessage) {
      setMessage(null);
    }
    try {
      const [invoiceResult, clientResult, estimateResult] = await Promise.all([
        listInvoices(session.sessionToken),
        listCrmClients(session.sessionToken),
        listEstimates(session.sessionToken),
      ]);
      setInvoices(invoiceResult.items);
      setSummary(invoiceResult.summary);
      setClients(clientResult.items.filter((client) => client.status !== "archived"));
      setEstimates(estimateResult.items);
      if (selectedInvoice) {
        await loadDetail(selectedInvoice.invoiceId);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar facturacion.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(invoiceId: string) {
    const detail = await getInvoice(session.sessionToken, invoiceId);
    setSelectedInvoice(detail.invoice);
    setSelectedItems(detail.items);
    setSelectedPayments(detail.payments);
    setSelectedHistory(detail.history || []);
  }

  async function handleSelect(invoice: Invoice) {
    setMessage(null);
    if (selectedInvoice?.invoiceId === invoice.invoiceId) {
      setSelectedInvoice(null);
      setSelectedItems([]);
      setSelectedPayments([]);
      setSelectedHistory([]);
      setActivePanel(null);
      setPendingInvoice(null);
      return;
    }
    try {
      await loadDetail(invoice.invoiceId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo abrir factura.");
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.estimateId && !confirmEstimateInvoice) {
      setConfirmEstimateInvoice(true);
      setMessage(null);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const estimateId = form.estimateId || null;
      const invoice = await createInvoice(session.sessionToken, {
        ...form,
        estimateId,
        clientId: estimateId ? undefined : form.clientId,
        items: estimateId
          ? undefined
          : (form.items || []).map((item) => ({
              ...item,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              taxAmount: Number(item.taxAmount || 0),
            })),
      });
      setForm(initialInvoice);
      setActivePanel(null);
      setConfirmEstimateInvoice(false);
      setMessage("Factura creada en borrador.");
      dispatchDataChanged("invoicing");
      await refresh({ preserveMessage: true });
      await loadDetail(invoice.invoiceId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear factura.");
    } finally {
      setSaving(false);
    }
  }

  function prepareIssue(invoice: Invoice) {
    setPendingInvoice(invoice);
    setSelectedInvoice(invoice);
    setActivePanel(activePanel === "issue" && pendingInvoice?.invoiceId === invoice.invoiceId ? null : "issue");
    setMessage(null);
  }

  async function handleIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingInvoice) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await issueInvoice(session.sessionToken, pendingInvoice.invoiceId);
      setActivePanel(null);
      setPendingInvoice(null);
      setMessage("Factura emitida y registrada en finanzas.");
      dispatchDataChanged("invoicing");
      await refresh({ preserveMessage: true });
      await loadDetail(pendingInvoice.invoiceId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo emitir factura.");
    } finally {
      setSaving(false);
    }
  }

  function preparePayment(invoice: Invoice) {
    setPendingInvoice(invoice);
    setSelectedInvoice(invoice);
    setPaymentForm({
      amount: Number(invoice.balanceAmount || 0),
      method: "bank_transfer",
      receivedAt: new Date().toISOString().slice(0, 16),
      reference: "",
      notes: "",
    });
    setActivePanel(activePanel === "payment" && pendingInvoice?.invoiceId === invoice.invoiceId ? null : "payment");
    setMessage(null);
  }

  async function handlePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingInvoice) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await recordInvoicePayment(session.sessionToken, pendingInvoice.invoiceId, {
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        receivedAt: new Date(paymentForm.receivedAt).toISOString(),
        reference: paymentForm.reference || "Registro manual",
        notes: paymentForm.notes,
      });
      setActivePanel(null);
      setPendingInvoice(null);
      setMessage("Cobro registrado y conciliado contra cuentas por cobrar.");
      dispatchDataChanged("invoicing");
      await refresh({ preserveMessage: true });
      await loadDetail(pendingInvoice.invoiceId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar cobro.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadInvoice(invoice: Invoice) {
    setSaving(true);
    setMessage(null);
    try {
      const blob = await downloadInvoicePdf(session.sessionToken, invoice.invoiceId);
      saveDocumentToCurrentDevice(blob, `${invoice.invoiceNumber}.pdf`);
      setMessage("PDF de factura generado y archivado.");
      dispatchDataChanged("documents");
      await refresh({ preserveMessage: true });
      await loadDetail(invoice.invoiceId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo descargar PDF.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadReceipt(payment: InvoicePayment) {
    if (!selectedInvoice) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const blob = await downloadReceiptPdf(session.sessionToken, selectedInvoice.invoiceId, payment.paymentId);
      saveDocumentToCurrentDevice(blob, `${payment.receiptNumber || payment.paymentId}.pdf`);
      setMessage("Recibo PDF generado y archivado.");
      await loadDetail(selectedInvoice.invoiceId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo descargar recibo.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePrepareEmail(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setSaving(true);
    setMessage(null);
    try {
      const delivery = await sendInvoiceEmail(session.sessionToken, invoice.invoiceId);
      setMessage(`Correo preparado en sandbox para ${delivery.recipientEmail}. No se envio fuera del sistema.`);
      dispatchDataChanged("invoicing");
      await refresh({ preserveMessage: true });
      await loadDetail(invoice.invoiceId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo preparar el correo de factura.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePrintInvoice(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setSaving(true);
    setMessage(null);
    try {
      const blob = await downloadInvoicePdf(session.sessionToken, invoice.invoiceId);
      const opened = openBlobInDocumentViewer(blob, `${invoice.invoiceNumber}.pdf`);
      setMessage(opened ? "PDF real abierto para imprimir desde el visor del dispositivo." : "PDF descargado porque el navegador bloqueo la ventana de impresion.");
      dispatchDataChanged("documents");
      await refresh({ preserveMessage: true });
      await loadDetail(invoice.invoiceId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo preparar el PDF para imprimir.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreditNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedInvoice) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const creditNote = await createCreditNote(session.sessionToken, selectedInvoice.invoiceId, {
        amount: Number(creditAmount),
        reason: creditReason,
      });
      setCreditAmount(0);
      setCreditReason("");
      setActivePanel(null);
      setMessage(`Rectificativa creada: ${creditNote.invoiceNumber}.`);
      dispatchDataChanged("invoicing");
      await refresh({ preserveMessage: true });
      await loadDetail(creditNote.invoiceId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear rectificativa.");
    } finally {
      setSaving(false);
    }
  }

  function updateItem(index: number, patch: Partial<NonNullable<InvoiceInput["items"]>[number]>) {
    const items = [...(form.items || [])];
    items[index] = { ...items[index], ...patch };
    setForm({ ...form, items });
  }

  function addItem() {
    setForm({
      ...form,
      items: [...(form.items || []), { description: "", quantity: 1, unitCode: "unit", unitPrice: 0, taxAmount: 0 }],
    });
  }

  return (
    <section className="production-module-content">
      <PageHeader
        eyebrow="Facturacion real F9.2"
        title="Facturas y cobros"
        description="Facturas por tenant, cobros, saldos, cuentas por cobrar y movimientos financieros reales. Sin datos demo."
        actions={
          <div className="segmented-actions">
            <Button variant="primary" type="button" icon={<Plus size={16} />} onClick={() => setActivePanel(activePanel === "create" ? null : "create")}>
              Crear factura
            </Button>
            <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>
              Actualizar
            </Button>
          </div>
        }
      />

      {message ? <p className="login-notice">{message}</p> : null}

      <section className="grid stats-grid crm-real-stats">
        <SummaryCard label="Facturado" value={loading && invoices.length === 0 ? "Cargando" : formatMoney(summary.total || 0, currency)} icon={<FileText size={20} />} />
        <SummaryCard label="Por cobrar" value={loading && invoices.length === 0 ? "Cargando" : formatMoney(summary.open || 0, currency)} icon={<Receipt size={20} />} />
        <SummaryCard label="Vencido" value={loading && invoices.length === 0 ? "Cargando" : formatMoney(summary.overdue || 0, currency)} icon={<Banknote size={20} />} />
        <SummaryCard label="Cobrado" value={loading && invoices.length === 0 ? "Cargando" : formatMoney(summary.collected || 0, currency)} icon={<FileCheck2 size={20} />} />
      </section>

      <BasicModal title="Crear factura" open={activePanel === "create"} onClose={() => setActivePanel(null)} size="wide" footer={null}>
        <form className="auth-form" onSubmit={handleCreate}>
          <div className="card-title-row">
            <span className="activity-meta">La factura nace en borrador. Emitir y cobrar son acciones separadas con confirmacion.</span>
            <StatusBadge label="Borrador" tone="neutral" />
          </div>

          <label className="form-control">
            <span>Cotizacion aprobada opcional</span>
            <select
              className="select"
              value={form.estimateId || ""}
              onChange={(event) => {
                const estimate = approvedEstimates.find((item) => item.estimateId === event.target.value);
                setForm({
                  ...form,
                  estimateId: event.target.value,
                  clientId: estimate?.clientId || form.clientId,
                  title: estimate?.title || form.title,
                  currency: (estimate?.currency as InvoiceInput["currency"]) || form.currency,
                });
              }}
            >
              <option value="">Factura manual</option>
              {approvedEstimates.map((estimate) => (
                <option value={estimate.estimateId} key={estimate.estimateId}>
                  {estimate.estimateNumber} - {estimate.clientName} - {formatMoney(estimate.totalAmount, estimate.currency)}
                </option>
              ))}
            </select>
          </label>

          {selectedApprovedEstimate ? (
            <p className="login-notice">
              Cotizacion {selectedApprovedEstimate.estimateNumber} seleccionada para {selectedApprovedEstimate.clientName}. Revisa el importe y pulsa Crear factura desde cotizacion; antes de generarla se pedira confirmacion.
            </p>
          ) : null}

          {!form.estimateId ? (
            <label className="form-control">
              <span>Cliente</span>
              <select className="select" value={form.clientId || ""} onChange={(event) => setForm({ ...form, clientId: event.target.value })} required>
                <option value="">Seleccionar cliente</option>
                {clients.map((client) => (
                  <option value={client.clientId} key={client.clientId}>{client.name}</option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid proof-grid">
            <label className="form-control">
              <span>Titulo</span>
              <input className="input" value={form.title || ""} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </label>
            <label className="form-control">
              <span>Moneda</span>
              <select className="select" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value as InvoiceInput["currency"] })}>
                <option value="USD">USD</option>
                <option value="COP">COP</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
            <label className="form-control">
              <span>Pais</span>
              <select className="select" value={form.countryProfile} onChange={(event) => setForm({ ...form, countryProfile: event.target.value as InvoiceInput["countryProfile"] })}>
                <option value="US">Estados Unidos</option>
                <option value="CO">Colombia</option>
                <option value="ES">Espana</option>
              </select>
            </label>
            <label className="form-control">
              <span>Idioma documento</span>
              <select className="select" value={form.documentLanguage} onChange={(event) => setForm({ ...form, documentLanguage: event.target.value as InvoiceInput["documentLanguage"] })}>
                <option value="es">Espanol</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="form-control">
              <span>Fecha</span>
              <input className="input" type="date" value={form.issueDate || ""} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} />
            </label>
            <label className="form-control">
              <span>Vence</span>
              <input className="input" type="date" value={form.dueDate || ""} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            </label>
          </div>

          {!form.estimateId ? (
            <div className="responsive-table">
              {(form.items || []).map((item, index) => (
                <article className="table-row invoice-items-grid" key={`item-${index}`}>
                  <div className="line-item-mobile-heading">Partida {index + 1}</div>
                  <label className="form-control compact-line-control">
                    <span>Descripcion de partida</span>
                    <input className="input" aria-label={`Descripcion de partida ${index + 1}`} placeholder="Descripcion: ej. instalacion de ceramica" value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} required />
                  </label>
                  <label className="form-control compact-line-control">
                    <span>Cantidad</span>
                    <input className="input" type="number" inputMode="decimal" min="0" step="0.01" aria-label={`Cantidad de partida ${index + 1}`} placeholder="Cantidad" value={item.quantity || ""} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} required />
                  </label>
                  <label className="form-control compact-line-control">
                    <span>Precio unitario</span>
                    <input className="input" type="number" inputMode="decimal" min="0" step="0.01" aria-label={`Precio unitario de partida ${index + 1}`} placeholder="Precio unitario" value={item.unitPrice || ""} onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })} required />
                  </label>
                  <label className="form-control compact-line-control">
                    <span>Impuesto de la partida</span>
                    <input className="input" type="number" inputMode="decimal" min="0" step="0.01" aria-label={`Impuesto de partida ${index + 1}`} placeholder="Impuesto" value={item.taxAmount || ""} onChange={(event) => updateItem(index, { taxAmount: Number(event.target.value) })} />
                  </label>
                </article>
              ))}
              <div className="line-item-bottom-actions">
                <Button variant="secondary" type="button" icon={<Plus size={16} />} onClick={addItem}>
                  Agregar otra partida
                </Button>
              </div>
            </div>
          ) : null}

          <Button variant="primary" type="submit" icon={<Save size={16} />} disabled={saving}>
            {selectedApprovedEstimate ? "Crear factura desde cotizacion" : "Crear factura"}
          </Button>
        </form>
      </BasicModal>

      <BasicModal title="Confirmar factura desde cotizacion" open={confirmEstimateInvoice} onClose={() => setConfirmEstimateInvoice(false)} footer={null}>
        {selectedApprovedEstimate ? (
          <form className="auth-form" onSubmit={handleCreate}>
            <div className="card-title-row">
              <StatusBadge label={selectedApprovedEstimate.estimateNumber} tone="success" />
              <StatusBadge label={formatMoney(selectedApprovedEstimate.totalAmount, selectedApprovedEstimate.currency)} tone="info" />
            </div>
            <strong>Esta seguro de generar una factura desde esta cotizacion?</strong>
            <p className="login-security-note">
              Se creara una factura en borrador ligada a la cotizacion aprobada. Luego podras emitirla, cobrarla o dejarla pendiente desde el modulo Facturas.
            </p>
            <div className="segmented-actions">
              <Button variant="secondary" type="button" onClick={() => setConfirmEstimateInvoice(false)} disabled={saving}>
                Volver
              </Button>
              <Button variant="primary" type="submit" icon={<FileCheck2 size={16} />} disabled={saving}>
                Si, crear factura
              </Button>
            </div>
          </form>
        ) : null}
      </BasicModal>

      <section className="grid crm-real-grid">
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Facturas recientes</h2>
            <StatusBadge label={loading ? "Cargando" : `${invoices.length} facturas`} tone="info" />
          </div>
          {!loading && invoices.length === 0 ? <EmptyState title="Sin facturas" description="Crea una factura manual o desde una cotizacion aprobada." /> : null}
          <div className="responsive-table">
            {invoices.map((invoice) => (
              <article className="table-row invoices-table-grid" key={invoice.invoiceId}>
                <div>
                  <strong>{invoice.invoiceNumber}</strong>
                  <span className="activity-meta">{invoice.title}</span>
                </div>
                <div>
                  <strong>{invoice.clientName}</strong>
                  <span className="activity-meta">{invoice.dueDate ? `Vence ${invoice.dueDate}` : "Sin vencimiento"}</span>
                </div>
                <StatusBadge label={statusLabels[invoice.status]} tone={statusTone[invoice.status]} />
                <strong>{formatMoney(invoice.balanceAmount, invoice.currency)}</strong>
                <div className="segmented-actions">
                  <Button variant="secondary" type="button" onClick={() => void handleSelect(invoice)}>Ver</Button>
                  <Button variant="secondary" type="button" onClick={() => prepareIssue(invoice)} disabled={saving || invoice.status !== "draft"}>Emitir</Button>
                  <Button variant="secondary" type="button" onClick={() => preparePayment(invoice)} disabled={saving || invoice.balanceAmount <= 0 || invoice.status === "draft"}>
                    Cobrar
                  </Button>
                  <Button variant="secondary" type="button" icon={<Download size={16} />} onClick={() => void handleDownloadInvoice(invoice)} disabled={saving}>
                    PDF
                  </Button>
                  <Button variant="secondary" type="button" icon={<Mail size={16} />} onClick={() => handlePrepareEmail(invoice)} disabled={saving}>
                    Correo
                  </Button>
                  <Button variant="secondary" type="button" icon={<Printer size={16} />} onClick={() => void handlePrintInvoice(invoice)} disabled={saving}>
                    Abrir PDF
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <BasicModal
        title={selectedInvoice ? `${selectedInvoice.invoiceNumber} - ${selectedInvoice.title}` : "Detalle de factura"}
        open={Boolean(selectedInvoice)}
        onClose={() => {
          setSelectedInvoice(null);
          setSelectedItems([]);
          setSelectedPayments([]);
          setSelectedHistory([]);
          setActivePanel(null);
          setPendingInvoice(null);
        }}
        size="wide"
        footer={null}
      >
        {selectedInvoice ? (
        <div className="grid two-column crm-real-grid document-detail-modal">
          <div className="card">
            <div className="card-title-row">
              <h2 className="card-title">{selectedInvoice.invoiceNumber}</h2>
              <StatusBadge label={statusLabels[selectedInvoice.status]} tone={statusTone[selectedInvoice.status]} />
            </div>
            <div className="segmented-actions" style={{ marginBottom: 12 }}>
              <Button variant="secondary" type="button" onClick={() => prepareIssue(selectedInvoice)} disabled={saving || selectedInvoice.status !== "draft"}>
                Emitir
              </Button>
              <Button variant="secondary" type="button" onClick={() => preparePayment(selectedInvoice)} disabled={saving || selectedInvoice.balanceAmount <= 0 || selectedInvoice.status === "draft"}>
                Cobrar
              </Button>
              <Button variant="secondary" type="button" icon={<Download size={16} />} onClick={() => void handleDownloadInvoice(selectedInvoice)} disabled={saving}>
                PDF
              </Button>
              <Button variant="secondary" type="button" icon={<Mail size={16} />} onClick={() => handlePrepareEmail(selectedInvoice)} disabled={saving}>
                Correo
              </Button>
              <Button variant="secondary" type="button" icon={<Printer size={16} />} onClick={() => void handlePrintInvoice(selectedInvoice)} disabled={saving}>
                Abrir PDF
              </Button>
            </div>
            {selectedInvoice.invoiceType === "credit_note" ? (
              <p className="login-notice">Rectifica {selectedInvoice.correctsInvoiceNumber || selectedInvoice.correctsInvoiceId}. {selectedInvoice.correctionReason}</p>
            ) : null}
            <div className="document-preview document-preview-inline">
              <div className="preview-paper">
                <p className="eyebrow">{selectedInvoice.documentLanguage === "en" ? "Invoice" : "Factura"}</p>
                <h2>{selectedInvoice.invoiceNumber}</h2>
                <p>{selectedInvoice.clientName}</p>
                <p className="activity-meta">{selectedInvoice.countryProfile} · {selectedInvoice.currency} · {selectedInvoice.issueDate}</p>
                <hr />
                {selectedItems.map((item) => (
                  <p key={item.invoiceItemId}>{item.description}: {formatMoney(item.totalAmount, selectedInvoice.currency)}</p>
                ))}
                <strong>Total {formatMoney(selectedInvoice.totalAmount, selectedInvoice.currency)}</strong>
                <p className="activity-meta">Saldo {formatMoney(selectedInvoice.balanceAmount, selectedInvoice.currency)}</p>
              </div>
            </div>
          </div>

          <BasicModal title="Confirmar emision" open={Boolean(activePanel === "issue" && pendingInvoice)} onClose={() => setActivePanel(null)} footer={null}>
            <form className="auth-form" onSubmit={handleIssue}>
              <div className="card-title-row">
                <StatusBadge label={pendingInvoice?.invoiceNumber || "Factura"} tone="warning" />
              </div>
              <strong>Esta seguro de emitir esta factura?</strong>
              <p className="activity-meta">
                Al emitir la factura se registra en cuentas por cobrar y queda trazada en finanzas. Esta accion no borra historial.
              </p>
              <Button variant="primary" type="submit" icon={<FileCheck2 size={16} />} disabled={saving}>
                Si, emitir factura
              </Button>
            </form>
          </BasicModal>

          <BasicModal title="Registrar cobro" open={Boolean(activePanel === "payment" && pendingInvoice)} onClose={() => setActivePanel(null)} size="wide" footer={null}>
            <form className="auth-form" onSubmit={handlePayment}>
              <div className="card-title-row">
                <StatusBadge label={pendingInvoice ? formatMoney(pendingInvoice.balanceAmount, pendingInvoice.currency) : "Sin factura"} tone="info" />
              </div>
              <strong>Esta seguro de registrar este cobro?</strong>
              <p className="login-security-note">Confirma el cobro antes de registrar. Este movimiento se reflejara automaticamente en Finanzas y quedara en historial.</p>
              <div className="grid proof-grid">
                <label className="form-control">
                  <span>Importe cobrado</span>
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    max={pendingInvoice?.balanceAmount || undefined}
                    step="0.01"
                    value={paymentForm.amount || ""}
                    onChange={(event) => setPaymentForm({ ...paymentForm, amount: Number(event.target.value) })}
                    required
                  />
                </label>
                <label className="form-control">
                  <span>Metodo</span>
                  <select className="select" value={paymentForm.method} onChange={(event) => setPaymentForm({ ...paymentForm, method: event.target.value })}>
                    <option value="bank_transfer">Transferencia</option>
                    <option value="cash">Efectivo</option>
                    <option value="card">Tarjeta</option>
                    <option value="check">Cheque</option>
                    <option value="other">Otro</option>
                  </select>
                </label>
                <label className="form-control">
                  <span>Fecha/hora</span>
                  <input className="input" type="datetime-local" value={paymentForm.receivedAt} onChange={(event) => setPaymentForm({ ...paymentForm, receivedAt: event.target.value })} />
                </label>
                <label className="form-control">
                  <span>Referencia</span>
                  <input className="input" value={paymentForm.reference} onChange={(event) => setPaymentForm({ ...paymentForm, reference: event.target.value })} />
                </label>
              </div>
              <label className="form-control">
                <span>Notas</span>
                <textarea className="input crm-textarea" value={paymentForm.notes} onChange={(event) => setPaymentForm({ ...paymentForm, notes: event.target.value })} />
              </label>
              <div className="segmented-actions">
                <Button variant="secondary" type="button" onClick={() => setPaymentForm({ ...paymentForm, amount: pendingInvoice?.balanceAmount || 0 })} disabled={!pendingInvoice}>
                  Cobro completo
                </Button>
                <Button variant="secondary" type="button" onClick={() => setPaymentForm({ ...paymentForm, amount: Math.round(((pendingInvoice?.totalAmount || 0) * 30)) / 100 })} disabled={!pendingInvoice}>
                  Anticipo 30%
                </Button>
                <Button variant="primary" type="submit" icon={<Banknote size={16} />} disabled={saving || paymentForm.amount <= 0}>
                  Confirmar cobro
                </Button>
              </div>
            </form>
          </BasicModal>

          <div className="card">
            <div className="card-title-row">
              <h2 className="card-title">Pagos</h2>
              <StatusBadge label={`${selectedPayments.length} registros`} tone="info" />
            </div>
            <div className="responsive-table">
              {selectedPayments.length === 0 ? <EmptyState title="Sin pagos" description="Cuando registres un cobro aparecera aqui." /> : null}
              {selectedPayments.map((payment) => (
                <article className="table-row payment-row-grid" key={payment.paymentId}>
                  <strong>{formatMoney(payment.amount, payment.currency)}</strong>
                  <span>{payment.method}</span>
                  <StatusBadge label={payment.status} tone="success" />
                  <div className="segmented-actions">
                    <span>{payment.receiptNumber || new Date(payment.receivedAt).toLocaleDateString()}</span>
                    <Button variant="secondary" type="button" icon={<Download size={16} />} onClick={() => void handleDownloadReceipt(payment)} disabled={saving}>
                      Recibo
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title-row">
              <h2 className="card-title">Historial</h2>
              <StatusBadge label={`${selectedHistory.length} eventos`} tone="info" />
            </div>
            <div className="responsive-table">
              {selectedHistory.length === 0 ? <EmptyState title="Sin cambios de estado" description="La emision, cobro o rectificacion quedara registrada aqui." /> : null}
              {selectedHistory.map((item) => (
                <article className="table-row payment-row-grid" key={`${item.toStatus}-${item.changedAt}`}>
                  <strong>{item.fromStatus || "Inicial"}</strong>
                  <span>{item.toStatus}</span>
                  <StatusBadge label="Auditable" tone="success" />
                  <span>{new Date(item.changedAt).toLocaleString()}</span>
                </article>
              ))}
            </div>
          </div>

          {selectedInvoice.invoiceType !== "credit_note" ? (
            <div className="card">
              <div className="card-title-row">
                <h2 className="card-title">Factura rectificativa</h2>
                <Button variant="secondary" type="button" icon={<RotateCcw size={16} />} onClick={() => setActivePanel(activePanel === "credit" ? null : "credit")}>
                  Crear rectificativa
                </Button>
              </div>
              <p className="activity-meta">Usa esta accion solo para corregir una factura emitida sin borrar historial.</p>
            </div>
          ) : null}

          <BasicModal title="Factura rectificativa" open={Boolean(selectedInvoice.invoiceType !== "credit_note" && activePanel === "credit")} onClose={() => setActivePanel(null)} size="wide" footer={null}>
            <form className="auth-form" onSubmit={handleCreditNote}>
              <div className="card-title-row">
                <StatusBadge label="Trazable" tone="warning" />
              </div>
              <label className="form-control">
                <span>Importe a rectificar</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max={selectedInvoice.balanceAmount}
                  step="0.01"
                  value={creditAmount || ""}
                  onChange={(event) => setCreditAmount(Number(event.target.value))}
                  required
                />
              </label>
              <label className="form-control">
                <span>Motivo</span>
                <textarea className="input crm-textarea" value={creditReason} onChange={(event) => setCreditReason(event.target.value)} required />
              </label>
              <Button variant="secondary" type="submit" icon={<RotateCcw size={16} />} disabled={saving || selectedInvoice.balanceAmount <= 0}>
                Crear rectificativa
              </Button>
            </form>
          </BasicModal>
        </div>
        ) : null}
      </BasicModal>
    </section>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
        </div>
        <span className="stat-icon info">{icon}</span>
      </div>
      <span className="stat-note">Calculado desde facturas reales</span>
    </article>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(value || 0);
}

function dispatchDataChanged(module: string) {
  window.dispatchEvent(new CustomEvent("constriqo:data-changed", { detail: { module } }));
}
