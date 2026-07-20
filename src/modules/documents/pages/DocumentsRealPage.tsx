import { AlertTriangle, CheckCircle2, FileArchive, FileClock, FileText, Plus, RefreshCw, Save, ShieldCheck, Trash2 } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { AuthenticatedSession } from "../../../app/auth/authClient";
import { Button } from "../../../shared/components/Button";
import { BasicModal } from "../../../shared/components/BasicModal";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import {
  cleanupArchivedHeavyFiles,
  createArchiveDocument,
  getDocumentArchivePlan,
  getDocumentCleanupStatus,
  listArchiveDocuments,
  markDocumentArchiveCompleted,
  type ArchiveDocument,
  type DocumentCleanupStatus,
  type DocumentInput,
  type DocumentStatus,
} from "../api/documentsClient";

type DocumentsRealPageProps = {
  session: AuthenticatedSession;
};

const initialForm: DocumentInput = {
  title: "",
  documentType: "general",
  status: "active",
  storageKey: "",
  storageSizeBytes: 0,
  relatedEntityType: "",
  relatedEntityId: "",
  expiresAt: "",
};

const initialCleanupForm = {
  email: "",
  password: "",
  totpCode: "",
  note: "",
  confirmExternalArchive: false,
};

const statusTone: Record<DocumentStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  active: "success",
  pending_review: "warning",
  expired: "danger",
  archived: "neutral",
  generated: "info",
};

export function DocumentsRealPage({ session }: DocumentsRealPageProps) {
  const [documents, setDocuments] = useState<ArchiveDocument[]>([]);
  const [archiveDue, setArchiveDue] = useState<ArchiveDocument[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [form, setForm] = useState<DocumentInput>(initialForm);
  const [archiveNote, setArchiveNote] = useState("");
  const [cleanupStatus, setCleanupStatus] = useState<DocumentCleanupStatus | null>(null);
  const [cleanupForm, setCleanupForm] = useState(initialCleanupForm);
  const [showCleanupForm, setShowCleanupForm] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const recentDocuments = useMemo(() => documents.slice(0, 50), [documents]);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(options: { preserveMessage?: boolean } = {}) {
    setLoading(true);
    if (!options.preserveMessage) {
      setMessage(null);
    }
    try {
      const result = await listArchiveDocuments(session.sessionToken);
      const archivePlan = await getDocumentArchivePlan(session.sessionToken);
      const cleanup = await getDocumentCleanupStatus(session.sessionToken);
      setDocuments(result.items);
      setSummary(result.summary || {});
      setArchiveDue(archivePlan.items);
      setCleanupStatus(cleanup);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar archivo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await createArchiveDocument(session.sessionToken, {
        ...form,
        storageKey: form.storageKey || undefined,
        storageSizeBytes: Number(form.storageSizeBytes || 0),
        relatedEntityType: form.relatedEntityType || undefined,
        relatedEntityId: form.relatedEntityId || undefined,
        expiresAt: form.expiresAt || undefined,
      });
      setForm(initialForm);
      setShowCreateForm(false);
      setMessage("Ficha de documento archivada. No se guardo ningun archivo pesado.");
      dispatchDataChanged("documents");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear ficha de documento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveCompleted() {
    if (archiveDue.length === 0) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const result = await markDocumentArchiveCompleted(session.sessionToken, {
        documentIds: archiveDue.map((document) => document.documentId),
        note: archiveNote || undefined,
      });
      setArchiveNote("");
      setMessage(`${result.updated} documento(s) marcados como archivados. Los registros y auditoria permanecen en la base de datos.`);
      dispatchDataChanged("documents");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo confirmar el archivo semestral.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCleanup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const result = await cleanupArchivedHeavyFiles(session.sessionToken, {
        email: cleanupForm.email,
        password: cleanupForm.password,
        totpCode: cleanupForm.totpCode,
        confirmExternalArchive: cleanupForm.confirmExternalArchive,
        note: cleanupForm.note || undefined,
      });
      setCleanupForm(initialCleanupForm);
      setShowCleanupForm(false);
      setMessage(`${result.updated} archivo(s) pesado(s) limpiados de forma segura. La metadata, historial y auditoria permanecen en la base de datos.`);
      dispatchDataChanged("documents");
      await refresh({ preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo completar la limpieza segura.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="production-module-content">
      <PageHeader
        eyebrow="Archivo F13"
        title="Archivo documental"
        description="Metadatos reales de PDFs, facturas, cotizaciones, recibos y documentos relacionados. No sube archivos pesados desde este modulo."
        actions={
          <div className="segmented-actions">
            <Button variant="primary" type="button" icon={<Plus size={16} />} onClick={() => setShowCreateForm((value) => !value)}>
              Crear ficha
            </Button>
            <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>
              Actualizar
            </Button>
          </div>
        }
      />

      {message ? <p className="login-notice">{message}</p> : null}

      <section className="grid stats-grid crm-real-stats">
        <SummaryCard label="Documentos" value={loading && documents.length === 0 ? "Cargando" : summary.total || documents.length} icon={<FileArchive size={20} />} />
        <SummaryCard label="Activos" value={loading && documents.length === 0 ? "Cargando" : summary.active || 0} icon={<FileText size={20} />} />
        <SummaryCard label="Por revisar" value={loading && documents.length === 0 ? "Cargando" : summary.pendingReview || 0} icon={<FileClock size={20} />} />
        <SummaryCard label="Por vencer" value={loading && documents.length === 0 ? "Cargando" : summary.expiring || 0} icon={<FileClock size={20} />} />
        <SummaryCard label="Archivo 6 meses" value={loading && documents.length === 0 ? "Cargando" : summary.archiveDue || archiveDue.length} icon={<FileArchive size={20} />} />
        <SummaryCard label="Limpieza segura" value={loading && !cleanupStatus ? "Cargando" : cleanupStatus?.eligibleCount || summary.cleanupCandidates || 0} icon={<ShieldCheck size={20} />} />
      </section>

      {cleanupStatus && cleanupStatus.severity !== "none" ? (
        <section className={`retention-alert ${cleanupStatus.severity === "danger" ? "danger" : "warning"}`} style={{ marginTop: 16 }}>
          <div>
            <strong>{cleanupStatus.severity === "danger" ? "Limpieza urgente de archivos" : "Limpieza recomendada de archivos"}</strong>
            <p>
              Debes archivar y limpiar los archivos pesados generados hasta {formatDate(cleanupStatus.cleanupCutoffAt)}. La alerta permanece hasta completar la operacion.
            </p>
          </div>
          <Button variant="secondary" type="button" icon={<ShieldCheck size={16} />} onClick={() => setShowCleanupForm(true)}>
            Revisar limpieza
          </Button>
        </section>
      ) : null}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Archivo semestral</h2>
            <p className="activity-meta">Descarga y guarda fuera de la app los archivos pesados antiguos. Al confirmar, solo se marca la metadata como archivada.</p>
          </div>
          <StatusBadge label={`${archiveDue.length} pendientes`} tone={archiveDue.length > 0 ? "warning" : "success"} />
        </div>
        {archiveDue.length === 0 ? (
          <EmptyState title="Sin documentos pendientes" description="No hay documentos con referencia de archivo de mas de 6 meses pendientes de archivo." />
        ) : (
          <>
            <div className="responsive-table" style={{ marginTop: 12 }}>
              <div className="table-header documents-table-grid">
                <span>Documento</span>
                <span>Relacion</span>
                <span>Estado</span>
                <span>Creado</span>
                <span>Storage</span>
              </div>
              {archiveDue.map((document) => (
                <article className="table-row documents-table-grid" key={document.documentId}>
                  <div>
                    <strong>{document.title}</strong>
                    <p className="activity-meta">{document.documentType}</p>
                  </div>
                  <div>
                    <strong>{document.relatedEntityType || "Sin relacion"}</strong>
                    <p className="activity-meta">{document.relatedEntityId ? document.relatedEntityId.slice(0, 8) : "metadata"}</p>
                  </div>
                  <StatusBadge label={document.status} tone={statusTone[document.status]} />
                  <span>{formatDate(document.createdAt)}</span>
                  <span>{document.storageKey ? `${formatMb(document.storageSizeBytes)} MB` : "Sin archivo"}</span>
                </article>
              ))}
            </div>
            <label className="form-control" style={{ marginTop: 12 }}>
              <span>Nota de archivo</span>
              <input className="input" value={archiveNote} onChange={(event) => setArchiveNote(event.target.value)} placeholder="Ej. Descargado en carpeta Facturas 2026 / disco externo" />
            </label>
            <Button variant="primary" type="button" icon={<CheckCircle2 size={16} />} onClick={() => void handleArchiveCompleted()} disabled={saving}>
              Confirmar archivo descargado
            </Button>
          </>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Limpieza segura</h2>
            <p className="activity-meta">
              Elimina solo la referencia al PDF o imagen fisica ya archivada. No borra facturas, cotizaciones, registros contables, metadata ni auditoria.
            </p>
          </div>
          <StatusBadge
            label={cleanupStatus ? `${cleanupStatus.eligibleCount} listos` : "Revisando"}
            tone={cleanupStatus?.severity === "danger" ? "danger" : cleanupStatus?.severity === "warning" ? "warning" : "success"}
          />
        </div>
        {cleanupStatus ? (
          <>
            <div className="retention-summary-grid">
              <div>
                <span className="activity-meta">Primer uso</span>
                <strong>{formatDate(cleanupStatus.firstUseAt)}</strong>
              </div>
              <div>
                <span className="activity-meta">Corte a limpiar</span>
                <strong>{formatDate(cleanupStatus.cleanupCutoffAt)}</strong>
              </div>
              <div>
                <span className="activity-meta">Dias vencidos</span>
                <strong>{cleanupStatus.daysOverdue}</strong>
              </div>
              <div>
                <span className="activity-meta">Pendientes de archivar</span>
                <strong>{cleanupStatus.requiresArchiveCount}</strong>
              </div>
            </div>
            <p className="retention-guidance">
              <AlertTriangle size={16} />
              {cleanupStatus.recommendation} Recomendacion: guarda una copia adicional fuera del telefono.
            </p>
            {cleanupStatus.requiresArchiveCount > 0 ? (
              <p className="login-notice">Primero confirma el archivo descargado de los documentos pendientes. La limpieza solo acepta archivos ya archivados.</p>
            ) : null}
            {cleanupStatus.eligibleCount === 0 ? (
              <EmptyState title="Sin archivos listos para limpiar" description="Cuando existan PDFs o imagenes archivadas dentro del corte, apareceran aqui para limpieza segura." />
            ) : (
              <>
                <div className="responsive-table" style={{ marginTop: 12 }}>
                  <div className="table-header documents-table-grid">
                    <span>Archivo</span>
                    <span>Relacion</span>
                    <span>Estado</span>
                    <span>Creado</span>
                    <span>Accion</span>
                  </div>
                  {cleanupStatus.items.map((document) => (
                    <article className="table-row documents-table-grid" key={document.documentId}>
                      <div>
                        <strong>{document.title}</strong>
                        <p className="activity-meta">{document.documentType}</p>
                      </div>
                      <div>
                        <strong>{document.relatedEntityType || "Sin relacion"}</strong>
                        <p className="activity-meta">{document.relatedEntityId ? document.relatedEntityId.slice(0, 8) : "metadata"}</p>
                      </div>
                      <StatusBadge label={document.status} tone={statusTone[document.status]} />
                      <span>{formatDate(document.createdAt)}</span>
                      <span>Quitar archivo fisico</span>
                    </article>
                  ))}
                </div>
                <Button variant="primary" type="button" icon={<ShieldCheck size={16} />} onClick={() => setShowCleanupForm((value) => !value)} disabled={cleanupStatus.requiresArchiveCount > 0}>
                  Limpieza con 2FA
                </Button>
              </>
            )}
          </>
        ) : (
          <EmptyState title="Calculando limpieza" description="Se esta revisando el ciclo de seis meses de esta empresa." />
        )}
      </section>

      <BasicModal title="Confirmar limpieza segura" open={showCleanupForm} onClose={() => setShowCleanupForm(false)} size="wide" footer={null}>
        <form className="auth-form" onSubmit={handleCleanup}>
          <div className="card-title-row">
            <div>
              <p className="activity-meta">Requiere correo, contrasena y codigo de dos factores del administrador conectado.</p>
            </div>
            <StatusBadge label="2FA requerido" tone="warning" />
          </div>
          <label className="form-control">
            <span>Correo administrador</span>
            <input className="input" type="email" value={cleanupForm.email} onChange={(event) => setCleanupForm({ ...cleanupForm, email: event.target.value })} required />
          </label>
          <label className="form-control">
            <span>Contrasena</span>
            <input className="input" type="password" value={cleanupForm.password} onChange={(event) => setCleanupForm({ ...cleanupForm, password: event.target.value })} required />
          </label>
          <label className="form-control">
            <span>Codigo de 6 digitos</span>
            <input
              className="input"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={cleanupForm.totpCode}
              onChange={(event) => setCleanupForm({ ...cleanupForm, totpCode: event.target.value.replace(/\D/gu, "") })}
              required
            />
          </label>
          <label className="form-control">
            <span>Nota de respaldo</span>
            <input className="input" value={cleanupForm.note} onChange={(event) => setCleanupForm({ ...cleanupForm, note: event.target.value })} placeholder="Ej. Copia guardada en disco externo junio 2026" />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={cleanupForm.confirmExternalArchive}
              onChange={(event) => setCleanupForm({ ...cleanupForm, confirmExternalArchive: event.target.checked })}
              required
            />
            <span>Confirmo que descargue y guarde los archivos en una PC o memoria externa. Entiendo que el PDF o imagen fisica no podra recuperarse desde la app.</span>
          </label>
          <Button variant="danger" type="submit" icon={<Trash2 size={16} />} disabled={saving}>
            Eliminar archivos pesados archivados
          </Button>
        </form>
      </BasicModal>

      <BasicModal title="Nueva ficha documental" open={showCreateForm} onClose={() => setShowCreateForm(false)} size="wide" footer={null}>
        <form className="auth-form" onSubmit={handleCreate}>
          <div className="card-title-row">
            <span className="activity-meta">Guarda metadata liviana. Los archivos pesados se archivan y limpian por flujo seguro.</span>
            <StatusBadge label="Metadata" tone="info" />
          </div>
          <div className="grid proof-grid">
            <label className="form-control">
              <span>Titulo</span>
              <input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            </label>
            <label className="form-control">
              <span>Tipo</span>
              <select className="select" value={form.documentType} onChange={(event) => setForm({ ...form, documentType: event.target.value })}>
                <option value="invoice_pdf">Factura PDF</option>
                <option value="estimate_pdf">Cotizacion PDF</option>
                <option value="receipt_pdf">Recibo PDF</option>
                <option value="contract">Contrato</option>
                <option value="general">General</option>
              </select>
            </label>
            <label className="form-control">
              <span>Estado</span>
              <select className="select" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as DocumentStatus })}>
                <option value="active">Activo</option>
                <option value="generated">Generado</option>
                <option value="pending_review">Revision</option>
                <option value="expired">Vencido</option>
                <option value="archived">Archivado</option>
              </select>
            </label>
            <label className="form-control">
              <span>Clave/ruta externa opcional</span>
              <input className="input" value={form.storageKey || ""} onChange={(event) => setForm({ ...form, storageKey: event.target.value })} />
            </label>
            <label className="form-control">
              <span>Tamano aproximado MB</span>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={bytesToMb(form.storageSizeBytes || 0)}
                onChange={(event) => setForm({ ...form, storageSizeBytes: mbToBytes(event.target.value) })}
              />
            </label>
            <label className="form-control">
              <span>Entidad relacionada</span>
              <input className="input" value={form.relatedEntityType || ""} onChange={(event) => setForm({ ...form, relatedEntityType: event.target.value })} placeholder="invoice, estimate, job..." />
            </label>
            <label className="form-control">
              <span>ID relacionado opcional</span>
              <input className="input" value={form.relatedEntityId || ""} onChange={(event) => setForm({ ...form, relatedEntityId: event.target.value })} />
            </label>
            <label className="form-control">
              <span>Vence el</span>
              <input className="input" type="date" value={form.expiresAt || ""} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
            </label>
          </div>
          <Button variant="primary" type="submit" icon={<Save size={16} />} disabled={saving}>
            Guardar ficha
          </Button>
        </form>
      </BasicModal>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-title-row">
          <h2 className="card-title">Archivo reciente</h2>
          <StatusBadge label={loading ? "Cargando" : `${recentDocuments.length} visibles`} tone="info" />
        </div>
        {!loading && recentDocuments.length === 0 ? (
          <EmptyState title="Sin documentos archivados" description="Las facturas/cotizaciones archivadas y fichas manuales apareceran aqui." />
        ) : (
          <div className="responsive-table">
            <div className="table-header documents-table-grid">
              <span>Documento</span>
              <span>Relacion</span>
              <span>Estado</span>
              <span>Vence</span>
              <span>Storage</span>
            </div>
            {recentDocuments.map((document) => (
              <article className="table-row documents-table-grid" key={document.documentId}>
                <div>
                  <strong>{document.title}</strong>
                  <p className="activity-meta">{document.documentType}</p>
                </div>
                <div>
                  <strong>{document.relatedEntityType || "Sin relacion"}</strong>
                  <p className="activity-meta">{document.relatedEntityId ? document.relatedEntityId.slice(0, 8) : "metadata"}</p>
                </div>
                <StatusBadge label={document.status} tone={statusTone[document.status]} />
                <span>{document.expiresAt || "Sin vencimiento"}</span>
                <span>{document.storageKey ? `${formatMb(document.storageSizeBytes)} MB` : "Sin archivo"}</span>
              </article>
            ))}
          </div>
        )}
      </section>
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
      <span className="stat-note">Solo metadata liviana</span>
    </article>
  );
}

function formatDate(value: string) {
  if (!value) {
    return "";
  }
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "short" }).format(new Date(value));
}

function mbToBytes(value: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }
  return Math.round(number * 1024 * 1024);
}

function bytesToMb(value: number) {
  if (!value) {
    return "";
  }
  return Math.round((value / 1024 / 1024) * 100) / 100;
}

function formatMb(value: number) {
  if (!value) {
    return "0.00";
  }
  const mb = value / 1024 / 1024;
  return mb >= 10 ? mb.toFixed(1) : mb.toFixed(2);
}

function dispatchDataChanged(module: string) {
  window.dispatchEvent(new CustomEvent("constructflow:data-changed", { detail: { module } }));
}
