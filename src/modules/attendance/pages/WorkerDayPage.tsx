import { Coffee, LogIn, LogOut, PauseCircle } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { jobs } from "../../jobs/mock-data/jobsData";
import { workforceMembers } from "../../workforce/mock-data/workforceData";
import { timeEntries } from "../mock-data/attendanceData";

export function WorkerDayPage() {
  const worker = workforceMembers[0];
  const entry = timeEntries[0];
  const job = jobs.find((item) => item.jobId === entry.jobId);

  return (
    <>
      <section className="worker-hero">
        <div>
          <p>Mi jornada</p>
          <h1>{entry.status}</h1>
        </div>
        <StatusBadge label={entry.reviewStatus} tone="warning" />
      </section>

      <section className="worker-card" style={{ marginTop: 14 }}>
        <PageHeader
          eyebrow={worker.name}
          title={job?.title || "Trabajo asignado"}
          description="Controles tactiles de jornada con estados simulados. No hay temporizador, servidor ni persistencia."
        />
        <div className="grid proof-grid">
          <VisualField label="Horario previsto" value={entry.expectedSchedule} />
          <VisualField label="Entrada" value={entry.checkIn} />
          <VisualField label="Inicio descanso" value={entry.breakStart} />
          <VisualField label="Fin descanso" value={entry.breakEnd} />
          <VisualField label="Salida" value={entry.checkOut} />
          <VisualField label="Total visual" value={entry.totalVisual} />
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
        <article className="worker-card">
          <h2 className="card-title">Estado de revision</h2>
          <p className="activity-meta">El gestor revisara excepciones, ubicacion imprecisa y registros sin conexion en fases futuras.</p>
          <div style={{ marginTop: 12 }}>
            <StatusBadge label={entry.perimeterStatus} tone="success" />
          </div>
        </article>
        <article className="worker-card">
          <h2 className="card-title">Historial breve</h2>
          <div className="grid" style={{ marginTop: 12 }}>
            {timeEntries
              .filter((item) => item.workerId === worker.workerId)
              .map((item) => (
                <StatusBadge key={item.timeEntryId} label={`${item.date} - ${item.totalVisual} - ${item.status}`} tone="neutral" />
              ))}
          </div>
        </article>
      </section>
    </>
  );
}
