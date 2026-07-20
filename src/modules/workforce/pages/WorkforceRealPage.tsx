import { FileWarning, KeyRound, Plus, RefreshCw, Save, UserCheck, Users } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import type { AuthenticatedSession } from "../../../app/auth/authClient";
import { BasicModal } from "../../../shared/components/BasicModal";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { resetTenantUserPassword } from "../../organization/api/organizationClient";
import {
  createWorker,
  createWorkerUser,
  getWorker,
  listWorkers,
  updateWorker,
  type WorkerDetailResponse,
  type WorkerInput,
  type WorkerStatus,
  type WorkerSummary,
  type WorkerUserInput,
} from "../api/workforceClient";

type WorkforceRealPageProps = {
  session: AuthenticatedSession;
};

const initialForm: WorkerInput = {
  name: "",
  trade: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  preferredLanguage: "es-US",
  notes: "",
};

const initialUserForm: WorkerUserInput = {
  name: "",
  email: "",
  trade: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  preferredLanguage: "es-US",
  notes: "",
  password: "",
};

const statusLabels: Record<WorkerStatus, string> = {
  active: "Activo",
  inactive: "Inactivo",
  suspended: "Suspendido",
};

const statusTone: Record<WorkerStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  active: "success",
  inactive: "neutral",
  suspended: "danger",
};

export function WorkforceRealPage({ session }: WorkforceRealPageProps) {
  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkerDetailResponse | null>(null);
  const [form, setForm] = useState<WorkerInput>(initialForm);
  const [userForm, setUserForm] = useState<WorkerUserInput>(initialUserForm);
  const [editForm, setEditForm] = useState<Partial<WorkerInput>>({});
  const [createAccessWithWorker, setCreateAccessWithWorker] = useState(false);
  const [workerAccessEmail, setWorkerAccessEmail] = useState("");
  const [createdAccess, setCreatedAccess] = useState<{ email: string; password: string } | null>(null);
  const [activePanel, setActivePanel] = useState<"worker" | "access" | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh(nextWorkerId?: string | null, options: { preserveMessage?: boolean } = {}) {
    setLoading(true);
    if (!options.preserveMessage) {
      setMessage(null);
    }
    try {
      const result = await listWorkers(session.sessionToken);
      setWorkers(result.items);
      setSummary(result.summary || {});
      if (nextWorkerId !== undefined) {
        setSelectedWorkerId(nextWorkerId);
        if (nextWorkerId) {
          const nextDetail = await getWorker(session.sessionToken, nextWorkerId);
          setDetail(nextDetail);
          setEditForm(workerToForm(nextDetail.worker));
        } else {
          setDetail(null);
          setEditForm({});
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudieron cargar trabajadores.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(workerId: string) {
    if (selectedWorkerId === workerId && detail) {
      setSelectedWorkerId(null);
      setDetail(null);
      setEditForm({});
      setEditOpen(false);
      setMessage(null);
      return;
    }
    setSelectedWorkerId(workerId);
    setMessage(null);
    try {
      const nextDetail = await getWorker(session.sessionToken, workerId);
      setDetail(nextDetail);
      setEditForm(workerToForm(nextDetail.worker));
      setEditOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el trabajador.");
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setCreatedAccess(null);
    try {
      if (createAccessWithWorker) {
        const created = await createWorkerUser(session.sessionToken, {
          ...form,
          email: workerAccessEmail,
          password: undefined,
        });
        setForm(initialForm);
        setWorkerAccessEmail("");
        setCreateAccessWithWorker(false);
        setCreatedAccess({ email: created.user.email, password: created.temporaryPassword });
        applyWorkerSnapshot(created.worker);
        setActivePanel(null);
        setMessage("Trabajador creado con acceso real. La clave temporal se muestra una sola vez.");
        dispatchDataChanged("workforce");
        void refresh(created.worker.workerId, { preserveMessage: true });
        return;
      }

      const created = await createWorker(session.sessionToken, form);
      setForm(initialForm);
      setWorkerAccessEmail("");
      setCreateAccessWithWorker(false);
      applyWorkerSnapshot(created);
      setActivePanel(null);
      setMessage("Trabajador creado con perfil y auditoria.");
      dispatchDataChanged("workforce");
      void refresh(created.workerId, { preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el trabajador.");
    } finally {
      setSaving(false);
    }
  }

  function selectWorkerForAccess(workerId: string) {
    const worker = workers.find((item) => item.workerId === workerId);
    setUserForm({
      ...initialUserForm,
      workerId: workerId || null,
      name: worker?.name || "",
      trade: worker?.trade || "",
      emergencyContactName: worker?.emergencyContactName || "",
      emergencyContactPhone: worker?.emergencyContactPhone || "",
      preferredLanguage: worker?.preferredLanguage || "es-US",
      notes: worker?.notes || "",
    });
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setCreatedAccess(null);
    try {
      const created = await createWorkerUser(session.sessionToken, {
        ...userForm,
        password: userForm.password || undefined,
      });
      setUserForm(initialUserForm);
      setCreatedAccess({ email: created.user.email, password: created.temporaryPassword });
      applyWorkerSnapshot(created.worker);
      setActivePanel(null);
      setMessage("Usuario trabajador creado, enlazado y auditado. La clave temporal se muestra una sola vez.");
      dispatchDataChanged("workforce");
      void refresh(created.worker.workerId, { preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el acceso del trabajador.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorkerId) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateWorker(session.sessionToken, selectedWorkerId, editForm);
      applyWorkerSnapshot(updated);
      setEditOpen(false);
      setMessage("Trabajador actualizado con auditoria.");
      dispatchDataChanged("workforce");
      void refresh(selectedWorkerId, { preserveMessage: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el trabajador.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetWorkerPassword(worker: WorkerSummary) {
    if (!worker.userId) {
      setMessage("Este trabajador aun no tiene usuario de login.");
      return;
    }
    const confirmed = window.confirm(`Generar una nueva clave para ${worker.name}? La clave anterior dejara de funcionar.`);
    if (!confirmed) {
      return;
    }
    setSaving(true);
    setMessage(null);
    setCreatedAccess(null);
    try {
      const result = await resetTenantUserPassword(session.sessionToken, worker.userId);
      setCreatedAccess({ email: result.user.email, password: result.temporaryPassword });
      setMessage("Nueva clave generada. La clave anterior fue reemplazada.");
      dispatchDataChanged("workforce");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo generar una nueva clave.");
    } finally {
      setSaving(false);
    }
  }

  function applyWorkerSnapshot(worker: WorkerSummary) {
    setWorkers((current) => {
      const next = [worker, ...current.filter((item) => item.workerId !== worker.workerId)];
      setSummary(summarizeWorkers(next));
      return next;
    });
    setSelectedWorkerId(worker.workerId);
    setDetail((current) => current?.worker.workerId === worker.workerId ? { ...current, worker } : current);
    setEditForm(workerToForm(worker));
  }

  return (
    <section className="production-module-content">
      <PageHeader
        eyebrow="Trabajadores reales"
        title="Personal"
        description="Directorio real por empresa, perfil laboral, contacto de emergencia y estado operativo. Preparado para login trabajador y asistencia."
        actions={
          <div className="segmented-actions">
            <Button variant="primary" type="button" icon={<Plus size={16} />} onClick={() => setActivePanel(activePanel === "worker" ? null : "worker")}>
              Crear trabajador
            </Button>
            <Button variant="secondary" type="button" icon={<KeyRound size={16} />} onClick={() => setActivePanel(activePanel === "access" ? null : "access")}>
              Crear acceso pendiente
            </Button>
            <Button variant="secondary" type="button" icon={<RefreshCw size={16} />} onClick={() => void refresh()} disabled={loading}>
              Actualizar
            </Button>
          </div>
        }
      />

      {message ? <p className="login-notice">{message}</p> : null}
      {createdAccess ? (
        <section className="login-notice">
          <strong>Acceso temporal creado:</strong> empresa <strong>{session.tenant.tenantId}</strong> · correo{" "}
          <strong>{createdAccess.email}</strong> · clave <strong>{createdAccess.password}</strong>
        </section>
      ) : null}

      <section className="grid stats-grid crm-real-stats">
        <SummaryCard label="Trabajadores" value={loading && workers.length === 0 ? "Cargando" : summary.total || 0} icon={<Users size={20} />} />
        <SummaryCard label="Activos" value={loading && workers.length === 0 ? "Cargando" : summary.active || 0} icon={<UserCheck size={20} />} />
        <SummaryCard label="Suspendidos" value={loading && workers.length === 0 ? "Cargando" : summary.suspended || 0} icon={<FileWarning size={20} />} />
        <SummaryCard label="Alertas doc." value={loading && workers.length === 0 ? "Cargando" : summary.documentAlerts || 0} icon={<FileWarning size={20} />} />
      </section>

      <section className="grid crm-real-grid">
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Directorio</h2>
            <StatusBadge label={loading ? "Cargando" : `${workers.length} registros`} tone="info" />
          </div>

          {!loading && workers.length === 0 ? (
            <EmptyState title="Sin trabajadores todavia" description="Crea trabajadores reales. No se cargan datos de ejemplo." />
          ) : (
            <div className="crm-client-list">
              {workers.map((worker) => (
                <article className="activity-item crm-client-row" key={worker.workerId}>
                  <span className="activity-icon"><Users size={18} /></span>
                  <button className="crm-client-button" type="button" onClick={() => void loadDetail(worker.workerId)}>
                    <strong>{worker.name}</strong>
                    <span>{worker.trade || "Sin oficio"} · asignaciones {worker.activeAssignments}</span>
                  </button>
                  <div className="crm-client-actions">
                    <StatusBadge label={statusLabels[worker.status]} tone={statusTone[worker.status]} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

      </section>

      <BasicModal title="Nuevo trabajador" open={activePanel === "worker"} onClose={() => setActivePanel(null)} footer={null}>
          <div className="card-title-row">
            <h2 className="card-title">Perfil laboral</h2>
            <StatusBadge label="Tenant activo" tone="success" />
          </div>
          <form className="auth-form" onSubmit={handleCreate}>
            <label className="form-control">
              <span>Nombre</span>
              <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </label>
            <label className="form-control">
              <span>Oficio / rol laboral</span>
              <input className="input" value={form.trade || ""} onChange={(event) => setForm({ ...form, trade: event.target.value })} />
            </label>
            <div className="grid proof-grid">
              <label className="form-control">
                <span>Contacto emergencia</span>
                <input className="input" value={form.emergencyContactName || ""} onChange={(event) => setForm({ ...form, emergencyContactName: event.target.value })} />
              </label>
              <label className="form-control">
                <span>Telefono emergencia</span>
                <input className="input" value={form.emergencyContactPhone || ""} onChange={(event) => setForm({ ...form, emergencyContactPhone: event.target.value })} />
              </label>
            </div>
            <label className="form-control">
              <span>Notas</span>
              <textarea className="input crm-textarea" value={form.notes || ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </label>
            <label className="form-control compact-check">
              <span>Crear acceso para este trabajador</span>
              <input
                type="checkbox"
                checked={createAccessWithWorker}
                onChange={(event) => {
                  setCreateAccessWithWorker(event.target.checked);
                  if (!event.target.checked) {
                    setWorkerAccessEmail("");
                  }
                }}
              />
            </label>
            {createAccessWithWorker ? (
              <label className="form-control">
                <span>Correo de login</span>
                <input className="input" type="email" value={workerAccessEmail} onChange={(event) => setWorkerAccessEmail(event.target.value)} required />
              </label>
            ) : null}
            {createAccessWithWorker ? (
              <p className="activity-meta">El sistema generara una clave temporal segura y la mostrara una sola vez al finalizar.</p>
            ) : null}
            <Button variant="primary" type="submit" icon={<Save size={16} />} disabled={saving}>
              {createAccessWithWorker ? "Crear trabajador y acceso" : "Crear trabajador"}
            </Button>
          </form>
      </BasicModal>

      <BasicModal title="Crear acceso pendiente" open={activePanel === "access"} onClose={() => setActivePanel(null)} size="wide" footer={null}>
        <section className="grid two-column crm-real-grid">
        <aside className="card">
          <div className="card-title-row">
            <h2 className="card-title">Enlazar acceso a trabajador</h2>
            <StatusBadge label="Login real" tone="info" />
          </div>
          <form className="auth-form" onSubmit={handleCreateUser}>
            <label className="form-control">
              <span>Trabajador sin acceso</span>
              <select className="select" value={userForm.workerId || ""} onChange={(event) => selectWorkerForAccess(event.target.value)} required>
                <option value="">Selecciona un trabajador</option>
                {workers
                  .filter((worker) => !worker.userId)
                  .map((worker) => (
                    <option value={worker.workerId} key={worker.workerId}>
                      {worker.name} · {worker.trade || "Sin oficio"}
                    </option>
                  ))}
              </select>
            </label>
            <label className="form-control">
              <span>Nombre</span>
              <input className="input" value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} required readOnly={Boolean(userForm.workerId)} />
            </label>
            <label className="form-control">
              <span>Correo de login</span>
              <input className="input" type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} required />
            </label>
            <p className="activity-meta">El sistema generara una clave temporal segura automaticamente y la mostrara una sola vez.</p>
            <Button variant="primary" type="submit" icon={<KeyRound size={16} />} disabled={saving}>
              Crear acceso
            </Button>
          </form>
        </aside>
        <div className="card">
          <h2 className="card-title">Reglas de acceso</h2>
          <div className="activity-list">
            <article className="activity-item">
              <span className="activity-icon"><UserCheck size={18} /></span>
              <div>
                <strong>Rol trabajador</strong>
                <span>Solo obtiene permisos de checklist y tareas asignadas.</span>
              </div>
            </article>
            <article className="activity-item">
              <span className="activity-icon"><KeyRound size={18} /></span>
              <div>
                <strong>Clave temporal</strong>
                <span>Se guarda solo como hash Argon2; el texto se muestra una vez al crear.</span>
              </div>
            </article>
          </div>
        </div>
      </section>
      </BasicModal>

      {detail ? (
        <section className="grid two-column crm-real-grid" style={{ marginTop: 16 }}>
          <article className="card">
            <div className="card-title-row">
              <div>
                <h2 className="card-title">{detail.worker.name}</h2>
                <p className="activity-meta">{detail.worker.userEmail || "Sin usuario de login vinculado"}</p>
              </div>
              <StatusBadge label={statusLabels[detail.worker.status]} tone={statusTone[detail.worker.status]} />
            </div>
            <div className="activity-list">
              <article className="activity-item">
                <span className="activity-icon"><Users size={18} /></span>
                <div>
                  <strong>{detail.worker.trade || "Sin oficio definido"}</strong>
                  <span>{detail.worker.userEmail || "Sin usuario de login vinculado"}</span>
                </div>
              </article>
              <article className="activity-item">
                <span className="activity-icon"><FileWarning size={18} /></span>
                <div>
                  <strong>Notas</strong>
                  <span>{detail.worker.notes || "Sin notas registradas."}</span>
                </div>
              </article>
            </div>
            <Button variant="secondary" type="button" icon={<Save size={16} />} onClick={() => setEditOpen(true)} disabled={saving}>
              Editar trabajador
            </Button>
            {detail.worker.userId ? (
              <Button variant="secondary" type="button" icon={<KeyRound size={16} />} onClick={() => void handleResetWorkerPassword(detail.worker)} disabled={saving}>
                Generar nueva clave
              </Button>
            ) : (
              <Button
                variant="secondary"
                type="button"
                icon={<KeyRound size={16} />}
                onClick={() => {
                  setActivePanel("access");
                  selectWorkerForAccess(detail.worker.workerId);
                }}
                disabled={saving}
              >
                Crear acceso pendiente
              </Button>
            )}
          </article>

          <BasicModal title="Editar trabajador" open={editOpen} onClose={() => setEditOpen(false)} footer={null}>
            <form className="auth-form" onSubmit={handleUpdate}>
            <label className="form-control">
              <span>Nombre</span>
              <input className="input" value={editForm.name || ""} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} required />
            </label>
            <div className="grid proof-grid">
              <label className="form-control">
                <span>Estado</span>
                <select className="select" value={editForm.status || "active"} onChange={(event) => setEditForm({ ...editForm, status: event.target.value as WorkerStatus })}>
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                  <option value="suspended">Suspendido</option>
                </select>
              </label>
              <label className="form-control">
                <span>Oficio</span>
                <input className="input" value={editForm.trade || ""} onChange={(event) => setEditForm({ ...editForm, trade: event.target.value })} />
              </label>
            </div>
            <label className="form-control">
              <span>Notas</span>
              <textarea className="input crm-textarea" value={editForm.notes || ""} onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })} />
            </label>
            <Button variant="secondary" type="submit" icon={<Save size={16} />} disabled={saving}>
              Guardar cambios
            </Button>
            </form>
          </BasicModal>

          <aside className="card">
            <h2 className="card-title">Documentos y disponibilidad</h2>
            <div className="responsive-table" style={{ marginTop: 16 }}>
              {detail.certifications.length === 0 ? <p className="activity-meta">Sin certificaciones registradas.</p> : null}
              {detail.certifications.map((certification) => (
                <article className="table-row worker-document-grid" key={certification.certificationId}>
                  <strong>{certification.name}</strong>
                  <StatusBadge label={certification.status} tone={certification.status === "valid" ? "success" : certification.status === "expired" ? "danger" : "warning"} />
                  <span>{certification.expiresAt || "Sin vencimiento"}</span>
                </article>
              ))}
            </div>
            <div className="responsive-table" style={{ marginTop: 16 }}>
              {detail.availability.length === 0 ? <p className="activity-meta">Sin disponibilidad registrada.</p> : null}
              {detail.availability.map((availability) => (
                <article className="table-row worker-document-grid" key={availability.availabilityId}>
                  <strong>{availability.date}</strong>
                  <StatusBadge label={availability.status} tone={availability.status === "available" ? "success" : "neutral"} />
                  <span>{availability.notes || "Sin notas"}</span>
                </article>
              ))}
            </div>
          </aside>
        </section>
      ) : null}
    </section>
  );
}

function workerToForm(worker: WorkerSummary): WorkerInput {
  return {
    userId: worker.userId || null,
    name: worker.name,
    status: worker.status,
    trade: worker.trade,
    emergencyContactName: worker.emergencyContactName,
    emergencyContactPhone: worker.emergencyContactPhone,
    preferredLanguage: worker.preferredLanguage,
    notes: worker.notes,
  };
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
      <span className="stat-note">Calculado en PostgreSQL para el tenant activo</span>
    </article>
  );
}

function summarizeWorkers(workers: WorkerSummary[]) {
  return {
    total: workers.length,
    active: workers.filter((worker) => worker.status === "active").length,
    suspended: workers.filter((worker) => worker.status === "suspended").length,
    documentAlerts: workers.reduce((total, worker) => total + Number(worker.documentAlerts || 0), 0),
  };
}

function dispatchDataChanged(module: string) {
  window.dispatchEvent(new CustomEvent("constructflow:data-changed", { detail: { module } }));
}
