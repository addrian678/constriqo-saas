import { useMemo, useState } from "react";
import { LockKeyhole, MailPlus, Search, ShieldCheck, UserCog, Users } from "lucide-react";
import type { DemoRole } from "../../../core/types/roles";
import { BasicModal } from "../../../shared/components/BasicModal";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import {
  organizationSummary,
  visualRoles,
  visualUsers,
  type VisualUserStatus,
} from "../mock-data/organizationData";

const userTone: Record<VisualUserStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  "Activo visual": "success",
  "Invitacion pendiente": "warning",
  "Suspendido visual": "danger",
};

const roleTone: Record<DemoRole, "neutral" | "info" | "warning" | "success" | "danger"> = {
  admin: "danger",
  manager: "info",
  worker: "success",
  super_admin: "danger",
};

export function UsersRolesPage() {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<DemoRole | "Todos">("Todos");
  const [modalOpen, setModalOpen] = useState(false);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return visualUsers.filter((user) => {
      const matchesRole = role === "Todos" || user.role === role;
      const matchesQuery =
        !normalizedQuery ||
        [user.name, user.email, user.status, user.notes, user.role].some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesRole && matchesQuery;
    });
  }, [query, role]);

  return (
    <>
      <PageHeader
        eyebrow="Administrador - V0.14"
        title="Usuarios y roles"
        description="Control visual de usuarios, invitaciones, roles y capacidades. Sin autenticacion real, correo, tokens ni cambios persistentes."
        actions={
          <Button variant="secondary" icon={<MailPlus size={18} />} onClick={() => setModalOpen(true)}>
            Invitar usuario
          </Button>
        }
      />

      <section className="grid stats-grid">
        <StatCard label="Usuarios" value={organizationSummary.users} note="Cuentas visuales" tone="info" icon={Users} />
        <StatCard label="Activos" value={organizationSummary.activeUsers} note="Sin sesion real" tone="positive" icon={ShieldCheck} />
        <StatCard label="Pendientes" value={organizationSummary.pendingInvites} note="Invitacion simulada" tone="warning" icon={MailPlus} />
        <StatCard label="Roles" value={organizationSummary.roles} note="Matriz visual" tone="danger" icon={UserCog} />
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Directorio de usuarios</h2>
              <p className="activity-meta">Los usuarios no autentican ni reciben invitaciones reales en V0.</p>
            </div>
            <StatusBadge label="Solo lectura" tone="neutral" />
          </div>
          <div className="filters-row">
            <label className="search-box crm-search">
              <Search size={18} />
              <input
                aria-label="Buscar usuarios"
                placeholder="Buscar por nombre, correo, rol o estado"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="form-control filter-control">
              <span className="visual-field-label">Rol</span>
              <select className="select" value={role} onChange={(event) => setRole(event.target.value as DemoRole | "Todos")}>
                <option>Todos</option>
                <option value="admin">admin</option>
                <option value="manager">manager</option>
                <option value="worker">worker</option>
              </select>
            </label>
          </div>

          {filteredUsers.length > 0 ? (
            <div className="responsive-table" style={{ marginTop: 16 }}>
              <div className="table-header users-table-grid">
                <span>Usuario</span>
                <span>Rol</span>
                <span>Estado</span>
                <span>Ultimo acceso</span>
              </div>
              {filteredUsers.map((user) => (
                <article className="table-row users-table-grid" key={user.userId}>
                  <div>
                    <strong>{user.name}</strong>
                    <p className="activity-meta">{user.email}</p>
                  </div>
                  <StatusBadge label={user.role} tone={roleTone[user.role]} />
                  <StatusBadge label={user.status} tone={userTone[user.status]} />
                  <div>
                    <strong>{user.lastSeen}</strong>
                    <p className="activity-meta">{user.notes}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin usuarios" description="No hay usuarios para los filtros actuales." />
          )}
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Roles base</h2>
            <LockKeyhole size={20} />
          </div>
          <div className="grid">
            {visualRoles.map((item) => (
              <article className="alert-card" key={item.role}>
                <div className="alert-heading">
                  <h3 className="alert-title">{item.label}</h3>
                  <StatusBadge label={item.scope} tone={roleTone[item.role]} />
                </div>
                <p className="alert-text">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Matriz de capacidades</h2>
            <p className="activity-meta">Representa permisos esperados; la autorizacion real en servidor queda para F1.</p>
          </div>
          <StatusBadge label="Visual" tone="info" />
        </div>
        <div className="responsive-table">
          <div className="table-header roles-table-grid">
            <span>Rol</span>
            <span>Capacidades</span>
            <span>Restricciones</span>
          </div>
          {visualRoles.map((item) => (
            <article className="table-row roles-table-grid" key={item.role}>
              <StatusBadge label={item.label} tone={roleTone[item.role]} />
              <span>{item.capabilities.join(", ")}</span>
              <span>{item.restrictedAreas.length > 0 ? item.restrictedAreas.join(", ") : "Sin restricciones visuales"}</span>
            </article>
          ))}
        </div>
      </section>

      <BasicModal title="Invitacion visual" open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="grid">
          <p className="activity-meta">
            Esta accion solo valida el flujo de UI. En F1 se usaran invitaciones con token temporal, expiracion, auditoria y permisos en servidor.
          </p>
          <label className="form-control">
            <span className="visual-field-label">Correo</span>
            <input className="input" value="nuevo.usuario@example.test" readOnly />
          </label>
          <label className="form-control">
            <span className="visual-field-label">Rol</span>
            <select className="select" value="worker" disabled>
              <option value="worker">Trabajador</option>
            </select>
          </label>
        </div>
      </BasicModal>
    </>
  );
}
