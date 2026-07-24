import { Building2, Clock, LogOut, Pencil, Plus, RefreshCw, Save, Trash2, Users } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { AuthenticatedSession } from "../../../app/auth/authClient";
import { brand } from "../../../branding/brand";
import { Button } from "../../../shared/components/Button";
import { BasicModal } from "../../../shared/components/BasicModal";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import {
  archiveCrmClient,
  createCrmActivity,
  createCrmClient,
  createCrmNote,
  getCrmClient,
  listCrmClients,
  updateCrmClient,
  type CrmClient,
  type CrmClientDetailResponse,
  type CrmClientInput,
  type CrmClientStatus,
  type CrmNote,
  type CrmSummary,
} from "../api/crmClient";

type CrmRealPageProps = {
  session: AuthenticatedSession;
  onLogout: () => void;
  busy?: boolean;
  embedded?: boolean;
};

const initialForm: CrmClientInput = {
  name: "",
  status: "lead",
  primaryContact: "",
  phone: "",
  email: "",
};

const emptySummary: CrmSummary = {
  total: 0,
  leads: 0,
  active: 0,
  on_hold: 0,
  archived: 0,
};

const statusLabels: Record<CrmClientStatus, string> = {
  lead: "Prospecto",
  active: "Activo",
  on_hold: "En pausa",
  archived: "Archivado",
};

const emptyRelated: CrmClientDetailResponse["related"] = {
  estimates: [],
  jobs: [],
  invoices: [],
};

export function CrmRealPage({ session, onLogout, busy, embedded }: CrmRealPageProps) {
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [summary, setSummary] = useState<CrmSummary>(emptySummary);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<CrmNote[]>([]);
  const [selectedRelated, setSelectedRelated] = useState<CrmClientDetailResponse["related"]>(emptyRelated);
  const [form, setForm] = useState<CrmClientInput>(initialForm);
  const [noteBody, setNoteBody] = useState("");
  const [activityTitle, setActivityTitle] = useState("");
  const [activePanel, setActivePanel] = useState<"client" | "note" | "activity" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedClient = useMemo(
    () => clients.find((client) => client.clientId === selectedClientId) || null,
    [clients, selectedClientId],
  );

  useEffect(() => {
    void refreshClients();
  }, []);

  useEffect(() => {
    if (!selectedClientId) {
      setSelectedNotes([]);
      setSelectedRelated(emptyRelated);
      return;
    }

    void loadClientDetail(selectedClientId);
  }, [selectedClientId]);

  async function refreshClients(nextSelectedId?: string | null, options: { preserveMessage?: boolean } = {}) {
    setLoading(true);
    if (!options.preserveMessage) {
      setMessage(null);
    }
    try {
      const result = await listCrmClients(session.sessionToken);
      setClients(result.items);
      setSummary(result.summary || emptySummary);
      if (nextSelectedId !== undefined) {
        setSelectedClientId(nextSelectedId);
      } else if (selectedClientId && !result.items.some((client) => client.clientId === selectedClientId)) {
        setSelectedClientId(result.items[0]?.clientId || null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar CRM.");
    } finally {
      setLoading(false);
    }
  }

  async function loadClientDetail(clientId: string) {
    try {
      const detail = await getCrmClient(session.sessionToken, clientId);
      setSelectedNotes(detail.notes);
      setSelectedRelated(detail.related || emptyRelated);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el detalle del cliente.");
    }
  }

  function startEdit(client: CrmClient) {
    setSelectedClientId(client.clientId);
    setForm({
      name: client.name,
      status: client.status,
      primaryContact: client.primaryContact,
      phone: client.phone,
      email: client.email,
    });
    setMessage(null);
    setActivePanel("client");
  }

  function resetForm() {
    setForm(initialForm);
    setSelectedClientId(null);
    setSelectedNotes([]);
    setSelectedRelated(emptyRelated);
    setNoteBody("");
    setActivityTitle("");
    setActivePanel(null);
  }

  async function handleSaveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      if (selectedClientId) {
        const updated = await updateCrmClient(session.sessionToken, selectedClientId, form);
        applyClientSnapshot(updated);
        setActivePanel(null);
        setMessage("Cliente actualizado correctamente.");
        void refreshClients(updated.clientId, { preserveMessage: true });
        window.dispatchEvent(new CustomEvent("constriqo:data-changed", { detail: { module: "crm", action: "updated" } }));
      } else {
        const created = await createCrmClient(session.sessionToken, form);
        applyClientSnapshot(created);
        setForm(initialForm);
        setActivePanel(null);
        setMessage("Cliente creado correctamente.");
        void refreshClients(created.clientId, { preserveMessage: true });
        window.dispatchEvent(new CustomEvent("constriqo:data-changed", { detail: { module: "crm", action: "created" } }));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar el cliente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveClient(clientId: string) {
    setSaving(true);
    setMessage(null);
    try {
      await archiveCrmClient(session.sessionToken, clientId);
      setClients((current) => {
        const next = current.filter((client) => client.clientId !== clientId);
        setSummary(summarizeVisibleClients(next));
        return next;
      });
      setMessage("Cliente archivado. El registro queda disponible para auditoria.");
      void refreshClients(null, { preserveMessage: true });
      window.dispatchEvent(new CustomEvent("constriqo:data-changed", { detail: { module: "crm", action: "archived" } }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo archivar el cliente.");
    } finally {
      setSaving(false);
    }
  }

  function applyClientSnapshot(client: CrmClient) {
    setClients((current) => {
      const next = [client, ...current.filter((item) => item.clientId !== client.clientId)];
      setSummary(summarizeVisibleClients(next));
      return next;
    });
    setSelectedClientId(client.clientId);
  }

  async function handleCreateNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClientId) {
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await createCrmNote(session.sessionToken, selectedClientId, noteBody);
      setNoteBody("");
      setActivePanel(null);
      await loadClientDetail(selectedClientId);
      setMessage("Nota guardada en el historial del cliente.");
      window.dispatchEvent(new CustomEvent("constriqo:data-changed", { detail: { module: "crm", action: "note-created" } }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la nota.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClientId) {
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await createCrmActivity(session.sessionToken, selectedClientId, activityTitle);
      setActivityTitle("");
      setActivePanel(null);
      await loadClientDetail(selectedClientId);
      setMessage("Actividad registrada y auditada.");
      window.dispatchEvent(new CustomEvent("constriqo:data-changed", { detail: { module: "crm", action: "activity-created" } }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar la actividad.");
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <section className={embedded ? "production-module-content" : "content"}>
      <PageHeader
        eyebrow="CRM real"
        title="Clientes"
        description="Modulo conectado a PostgreSQL con sesion SaaS, RLS y datos separados por empresa."
        actions={
          <div className="segmented-actions">
            <Button variant="primary" type="button" icon={<Plus size={16} />} onClick={() => { resetForm(); setActivePanel("client"); }}>
              Crear cliente
            </Button>
            <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refreshClients()} disabled={loading}>
              Actualizar
            </Button>
          </div>
        }
      />

      {message ? <p className="login-notice">{message}</p> : null}

      <section className="grid stats-grid crm-real-stats">
        <SummaryCard icon={<Users size={20} />} label="Clientes visibles" value={loading && clients.length === 0 ? "Cargando" : summary.total} />
        <SummaryCard icon={<Plus size={20} />} label="Prospectos" value={loading && clients.length === 0 ? "Cargando" : summary.leads} />
        <SummaryCard icon={<Building2 size={20} />} label="Activos" value={loading && clients.length === 0 ? "Cargando" : summary.active} />
        <SummaryCard icon={<Clock size={20} />} label="En pausa" value={loading && clients.length === 0 ? "Cargando" : summary.on_hold} />
      </section>

      <section className="grid crm-real-grid">
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Directorio</h2>
            <StatusBadge label={loading ? "Cargando" : `${clients.length} registros`} tone="info" />
          </div>

          {!loading && clients.length === 0 ? (
            <EmptyState
              title="Sin clientes todavia"
              description="Agrega el primer cliente desde el formulario. No se cargan datos de prueba en produccion."
            />
          ) : (
            <div className="crm-client-list">
              {clients.map((client) => (
                <article className="activity-item crm-client-row" key={client.clientId}>
                  <span className="activity-icon">
                    <Building2 size={18} />
                  </span>
                  <button className="crm-client-button" type="button" onClick={() => startEdit(client)}>
                    <strong>{client.name}</strong>
                    <span>{client.primaryContact || client.email || "Sin contacto principal"}</span>
                  </button>
                  <div className="crm-client-actions">
                    <StatusBadge label={statusLabels[client.status]} tone={client.status === "active" ? "success" : "neutral"} />
                    <Button
                      variant="secondary"
                      type="button"
                      icon={<Pencil size={15} />}
                      onClick={() => startEdit(client)}
                      disabled={saving}
                      aria-label={`Editar ${client.name}`}
                    />
                    <Button
                      variant="danger"
                      type="button"
                      icon={<Trash2 size={15} />}
                      onClick={() => void handleArchiveClient(client.clientId)}
                      disabled={saving}
                      aria-label={`Archivar ${client.name}`}
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <BasicModal title={selectedClient ? "Editar cliente" : "Nuevo cliente"} open={activePanel === "client"} onClose={() => setActivePanel(null)} size="wide" footer={null}>
          <div className="card-title-row">
            <span className="activity-meta">Cliente real del tenant. Sin datos demo ni registro publico.</span>
            {selectedClient ? <Button variant="secondary" type="button" onClick={resetForm}>Nuevo</Button> : null}
          </div>
          <form className="auth-form" onSubmit={handleSaveClient}>
            <label className="form-control">
              <span>Nombre del cliente</span>
              <input
                className="input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                minLength={2}
                maxLength={160}
                required
              />
            </label>
            <label className="form-control">
              <span>Estado</span>
              <select
                className="select"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as CrmClientStatus })}
              >
                <option value="lead">Prospecto</option>
                <option value="active">Activo</option>
                <option value="on_hold">En pausa</option>
              </select>
            </label>
            <label className="form-control">
              <span>Contacto principal</span>
              <input
                className="input"
                value={form.primaryContact}
                onChange={(event) => setForm({ ...form, primaryContact: event.target.value })}
                maxLength={120}
              />
            </label>
            <label className="form-control">
              <span>Telefono</span>
              <input
                className="input"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                maxLength={60}
              />
            </label>
            <label className="form-control">
              <span>Correo</span>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                maxLength={180}
              />
            </label>
            <Button variant="primary" type="submit" icon={<Save size={16} />} disabled={saving}>
              {selectedClient ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </form>
      </BasicModal>

      {selectedClient ? (
        <section className="grid two-column crm-real-grid" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-title-row">
              <div>
                <h2 className="card-title">{selectedClient.name}</h2>
                <p className="activity-meta">{selectedClient.primaryContact || selectedClient.email || "Sin contacto principal"}</p>
              </div>
              <div className="segmented-actions">
                <Button variant="secondary" type="button" icon={<Pencil size={16} />} onClick={() => startEdit(selectedClient)}>Editar</Button>
                <Button variant="secondary" type="button" icon={<Plus size={16} />} onClick={() => setActivePanel(activePanel === "note" ? null : "note")}>Nota</Button>
                <Button variant="secondary" type="button" icon={<Clock size={16} />} onClick={() => setActivePanel(activePanel === "activity" ? null : "activity")}>Actividad</Button>
                <StatusBadge label={statusLabels[selectedClient.status]} tone={selectedClient.status === "active" ? "success" : "neutral"} />
              </div>
            </div>
            <div className="session-summary">
              <span>Historial</span>
              <strong>{selectedNotes.length} notas</strong>
              {selectedNotes.slice(0, 5).map((note) => (
                <p className="crm-note" key={note.noteId}>
                  {note.body}
                </p>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title-row">
              <h2 className="card-title">Relacion comercial</h2>
              <StatusBadge label="Datos reales" tone="success" />
            </div>
            <div className="responsive-table">
              {selectedRelated.estimates.length === 0 && selectedRelated.jobs.length === 0 && selectedRelated.invoices.length === 0 ? (
                <EmptyState title="Sin relacion comercial" description="Las cotizaciones, obras y facturas del cliente apareceran aqui." />
              ) : null}
              {selectedRelated.estimates.map((estimate) => (
                <article className="table-row payment-row-grid" key={estimate.estimateId}>
                  <strong>{estimate.estimateNumber}</strong>
                  <span>{formatMoney(estimate.totalAmount, estimate.currency)}</span>
                  <StatusBadge label={estimate.status} tone={estimate.status === "approved" ? "success" : "neutral"} />
                  <span>Cotizacion</span>
                </article>
              ))}
              {selectedRelated.jobs.map((job) => (
                <article className="table-row payment-row-grid" key={job.jobId}>
                  <strong>{job.jobNumber}</strong>
                  <span>{job.title}</span>
                  <StatusBadge label={job.status} tone={job.status === "in_progress" ? "success" : "neutral"} />
                  <span>Obra</span>
                </article>
              ))}
              {selectedRelated.invoices.map((invoice) => (
                <article className="table-row payment-row-grid" key={invoice.invoiceId}>
                  <strong>{invoice.invoiceNumber}</strong>
                  <span>{formatMoney(invoice.balanceAmount, invoice.currency)} saldo</span>
                  <StatusBadge label={invoice.status} tone={invoice.status === "paid" ? "success" : "warning"} />
                  <span>Factura</span>
                </article>
              ))}
            </div>
          </div>

          <BasicModal title="Nota interna" open={activePanel === "note"} onClose={() => setActivePanel(null)} footer={null}>
              <form className="auth-form" onSubmit={handleCreateNote}>
                <label className="form-control">
                  <span>Nota interna</span>
                  <textarea
                    className="input crm-textarea"
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    minLength={2}
                    maxLength={2000}
                  />
                </label>
                <Button variant="secondary" type="submit" disabled={saving || noteBody.trim().length < 2}>
                  Guardar nota
                </Button>
              </form>
          </BasicModal>

          <BasicModal title="Actividad rapida" open={activePanel === "activity"} onClose={() => setActivePanel(null)} footer={null}>
              <form className="auth-form" onSubmit={handleCreateActivity}>
                <label className="form-control">
                  <span>Actividad rapida</span>
                  <input
                    className="input"
                    value={activityTitle}
                    onChange={(event) => setActivityTitle(event.target.value)}
                    minLength={2}
                    maxLength={180}
                  />
                </label>
                <Button variant="secondary" type="submit" disabled={saving || activityTitle.trim().length < 2}>
                  Registrar actividad
                </Button>
              </form>
          </BasicModal>
        </section>
      ) : null}
    </section>
  );

  if (embedded) {
    return content;
  }

  return (
    <main className="app-shell production-shell">
      <div className="production-topbar">
        <div className="brand-lockup">
          <img className="brand-logo-image brand-logo-official" src={brand.logoUrl} alt="" />
          <div>
            <p className="brand-name">Constriqo</p>
            <p className="brand-subtitle">{session.tenant.companyName}</p>
          </div>
        </div>
        <div className="production-session">
          <span>{session.user.displayName}</span>
          <Button variant="secondary" type="button" icon={<LogOut size={16} />} onClick={onLogout} disabled={busy || saving}>
            Cerrar sesion
          </Button>
        </div>
      </div>
      {content}
    </main>
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
      <span className="stat-note">Calculado desde datos reales del tenant activo</span>
    </article>
  );
}

function summarizeVisibleClients(items: CrmClient[]): CrmSummary {
  return items.reduce<CrmSummary>(
    (summary, client) => {
      if (client.status !== "archived") {
        summary.total += 1;
      }
      if (client.status === "lead") {
        summary.leads += 1;
      }
      if (client.status === "active") {
        summary.active += 1;
      }
      if (client.status === "on_hold") {
        summary.on_hold += 1;
      }
      if (client.status === "archived") {
        summary.archived += 1;
      }
      return summary;
    },
    { ...emptySummary },
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: currency || "USD" }).format(value || 0);
}
