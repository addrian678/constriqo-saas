import { CheckCircle2, MapPin, QrCode, Smartphone, WifiOff } from "lucide-react";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { attendanceStates, workerDay } from "../../../verticals/construction/mock-data/dashboard";
import type { StatusTone } from "../../../core/types/status";
import { timeEntries, workerAttendanceStates } from "../mock-data/attendanceData";

export function AttendancePage() {
  const entry = timeEntries[0];

  return (
    <>
      <PageHeader
        eyebrow="Trabajador - V0.6"
        title="Asistencia"
        description="Verificacion visual de entrada, perimetro, confirmacion y revision. Sin GPS, camara, QR, NFC ni servidor real."
      />
      <section className="grid two-column">
        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Chequeo visual de entrada</h2>
            <StatusBadge label="Pendiente de revision" tone="info" />
          </div>
          <div className="grid proof-grid">
            <VisualField label="Trabajo asignado" value={workerDay.project} />
            <VisualField label="Hora del servidor" value="08:02 AM (simulada)" />
            <VisualField label="Ubicacion puntual" value="Salt Lake City, UT (simulada)" />
            <VisualField label="Distancia respecto al lugar" value="42 m (visual)" />
            <VisualField label="Confirmacion del trabajador" value="Pendiente" />
            <VisualField label="Estado de revision" value={entry.reviewStatus} />
          </div>
        </div>
        <div className="grid">
          {[
            ["QR o NFC", "Espacio reservado para configuracion futura.", QrCode],
            ["Fotografia", "La camara no esta implementada en esta fase.", Smartphone],
            ["Sin conexion", "Estado visual sin cola offline real.", WifiOff],
          ].map(([title, text, Icon]) => (
            <article className="alert-card" key={String(title)}>
              <div className="alert-heading">
                <h3 className="alert-title">{String(title)}</h3>
                <Icon size={19} />
              </div>
              <p className="alert-text">{String(text)}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="worker-card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <h2 className="card-title">Checklist de verificacion</h2>
          <CheckCircle2 size={20} />
        </div>
        <div className="grid status-grid">
          {workerAttendanceStates.map((state) => (
            <StatusBadge key={state} label={state} tone="neutral" />
          ))}
        </div>
      </section>
      <section className="grid status-grid" style={{ marginTop: 18 }}>
        {attendanceStates.map(([title, text, tone]) => (
          <article className="worker-card" key={title}>
            <div className="card-title-row">
              <h2 className="card-title">{title}</h2>
              <MapPin size={18} />
            </div>
            <p className="activity-meta">{text}</p>
            <div style={{ marginTop: 12 }}>
              <StatusBadge label={title} tone={tone as StatusTone} />
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
