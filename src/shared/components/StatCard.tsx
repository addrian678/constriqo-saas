import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  note: string;
  tone?: "positive" | "warning" | "danger" | "info";
  icon: LucideIcon;
};

export function StatCard({ label, value, note, tone = "info", icon: Icon }: StatCardProps) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
        </div>
        <span className={`stat-icon ${tone}`}>
          <Icon size={21} />
        </span>
      </div>
      <span className="stat-note">{note}</span>
    </article>
  );
}
