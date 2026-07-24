import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  note: string;
  tone?: "positive" | "warning" | "danger" | "info";
  icon: LucideIcon;
  trend?: string;
  chart?: number[];
};

const defaultCharts: Record<NonNullable<StatCardProps["tone"]>, number[]> = {
  positive: [34, 42, 38, 56, 62, 70, 78, 86],
  warning: [62, 58, 65, 52, 48, 55, 50, 44],
  danger: [78, 70, 75, 66, 58, 63, 52, 48],
  info: [38, 46, 44, 54, 60, 58, 66, 74],
};

export function StatCard({ label, value, note, tone = "info", icon: Icon, trend, chart }: StatCardProps) {
  const bars = chart && chart.length > 0 ? chart : defaultCharts[tone];

  return (
    <article className={`stat-card stat-card-${tone}`}>
      <div className="stat-top">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
        </div>
        <span className={`stat-icon ${tone}`}>
          <Icon size={21} />
        </span>
      </div>
      <div className="stat-card-visual" aria-hidden="true">
        {bars.map((height, index) => (
          <span key={`${label}-${index}`} style={{ height: `${Math.max(18, Math.min(92, height))}%` }} />
        ))}
      </div>
      {trend ? <span className={`stat-trend ${tone}`}>{trend}</span> : null}
      <span className="stat-note">{note}</span>
    </article>
  );
}
