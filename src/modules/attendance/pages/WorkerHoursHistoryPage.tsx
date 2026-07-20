import { jobs } from "../../jobs/mock-data/jobsData";
import { workforceMembers } from "../../workforce/mock-data/workforceData";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { timeEntries } from "../mock-data/attendanceData";

export function WorkerHoursHistoryPage() {
  const worker = workforceMembers[0];
  const workerEntries = timeEntries.filter((entry) => entry.workerId === worker.workerId);

  return (
    <>
      <PageHeader
        eyebrow="Trabajador - V0.6"
        title="Historial de horas"
        description="Resumen visual de registros propios. Sin calculos laborales definitivos ni exportacion."
      />
      <section className="grid">
        {workerEntries.map((entry) => {
          const job = jobs.find((item) => item.jobId === entry.jobId);
          return (
            <article className="worker-card" key={entry.timeEntryId}>
              <div className="card-title-row">
                <div>
                  <h2 className="card-title">{entry.date}</h2>
                  <p className="activity-meta">{job?.title}</p>
                </div>
                <StatusBadge label={entry.totalVisual} tone="info" />
              </div>
              <div className="grid proof-grid">
                <StatusBadge label={`Entrada ${entry.checkIn}`} tone="neutral" />
                <StatusBadge label={`Salida ${entry.checkOut}`} tone="neutral" />
                <StatusBadge label={entry.status} tone="warning" />
                <StatusBadge label={entry.reviewStatus} tone="neutral" />
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}
