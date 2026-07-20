import { Coffee, LogIn, LogOut, PauseCircle } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { workerDay, workerVisualStates } from "../../../verticals/construction/mock-data/dashboard";

export function WorkerHome() {
  return (
    <>
      <section className="worker-hero">
        <div>
          <p>Hola, {workerDay.worker}</p>
          <h1>Trabajo asignado para hoy</h1>
        </div>
        <StatusBadge label={workerDay.dayStatus} tone="warning" />
      </section>
      <section className="worker-card" style={{ marginTop: 14 }}>
        <PageHeader
          eyebrow="Inicio del trabajador"
          title={workerDay.project}
          description="Resumen rapido para operar desde el movil durante la jornada."
        />
        <div className="grid proof-grid">
          <VisualField label="Direccion" value={workerDay.address} />
          <VisualField label="Horario previsto" value={workerDay.schedule} />
          <VisualField label="Responsable" value={workerDay.supervisor} />
          <VisualField label="Horas acumuladas de la semana" value={workerDay.weekHours} />
        </div>
        <div className="worker-actions" style={{ marginTop: 16 }}>
          <Button large icon={<LogIn size={20} />}>
            Registrar entrada
          </Button>
          <Button variant="secondary" icon={<Coffee size={18} />}>
            Iniciar descanso
          </Button>
          <Button variant="secondary" icon={<PauseCircle size={18} />}>
            Terminar descanso
          </Button>
          <Button variant="danger" icon={<LogOut size={18} />}>
            Registrar salida
          </Button>
        </div>
      </section>
      <section className="grid proof-grid" style={{ marginTop: 14 }}>
        <div className="worker-card">
          <h2 className="card-title">Pruebas pendientes</h2>
          <p className="stat-value">{workerDay.pendingProofs}</p>
          <p className="activity-meta">Evidencias visuales sin carga real de archivos.</p>
        </div>
        <div className="worker-card">
          <h2 className="card-title">Notificaciones importantes</h2>
          <ul className="activity-list" style={{ marginTop: 12 }}>
            {workerDay.notifications.map((notification) => (
              <li className="activity-meta" key={notification}>
                {notification}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="worker-card" style={{ marginTop: 14 }}>
        <div className="card-title-row">
          <h2 className="card-title">Estados simulados</h2>
          <StatusBadge label="Visual" tone="neutral" />
        </div>
        <div className="grid status-grid">
          {workerVisualStates.map((state) => (
            <StatusBadge key={state} label={state} tone={state.includes("activa") ? "success" : "neutral"} />
          ))}
        </div>
      </section>
    </>
  );
}
