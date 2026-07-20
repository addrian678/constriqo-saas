import { BarChart3, ClipboardList, FileText, ShieldAlert } from "lucide-react";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { VisualField } from "../../../shared/components/VisualField";
import { visualReports } from "../mock-data/notificationsData";

const reportTone: Record<(typeof visualReports)[number]["status"], "neutral" | "info" | "warning" | "success" | "danger"> = {
  "Listo visual": "success",
  "Pendiente de datos": "warning",
  Revision: "info",
};

export function ReportsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Administrador - V0.13"
        title="Informes"
        description="Catalogo visual de informes ejecutivos y operativos. Sin generacion PDF, exportacion, programacion ni envio real."
      />

      <section className="grid stats-grid">
        <StatCard label="Informes" value={String(visualReports.length)} note="Catalogo visual" tone="info" icon={BarChart3} />
        <StatCard label="Listos" value="1" note="No exportables" tone="positive" icon={FileText} />
        <StatCard label="En revision" value="1" note="Sin aprobacion real" tone="warning" icon={ClipboardList} />
        <StatCard label="Riesgos" value="1" note="Datos pendientes" tone="danger" icon={ShieldAlert} />
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Catalogo de informes</h2>
            <p className="activity-meta">Cada informe muestra alcance y fuentes, pero no genera archivos ni consultas reales.</p>
          </div>
          <StatusBadge label="V0.13 visual" tone="info" />
        </div>
        <div className="responsive-table">
          <div className="table-header reports-table-grid">
            <span>Informe</span>
            <span>Responsable</span>
            <span>Cadencia</span>
            <span>Estado</span>
          </div>
          {visualReports.map((report) => (
            <article className="table-row reports-table-grid" key={report.reportId}>
              <div>
                <strong>{report.title}</strong>
                <p className="activity-meta">{report.scope}</p>
              </div>
              <span>{report.owner}</span>
              <span>{report.cadence}</span>
              <StatusBadge label={report.status} tone={reportTone[report.status]} />
            </article>
          ))}
        </div>
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        {visualReports.map((report) => (
          <article className="card" key={report.reportId}>
            <div className="card-title-row">
              <h2 className="card-title">{report.title}</h2>
              <StatusBadge label={report.status} tone={reportTone[report.status]} />
            </div>
            <div className="grid proof-grid">
              <VisualField label="Frecuencia" value={report.cadence} />
              <VisualField label="Responsable" value={report.owner} />
              <VisualField label="Fuentes" value={report.sourceModules.join(", ")} />
              <VisualField label="Exportacion" value="Deshabilitada en V0.13" />
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
