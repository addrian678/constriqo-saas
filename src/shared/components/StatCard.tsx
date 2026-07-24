import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  note: string;
  tone?: "positive" | "warning" | "danger" | "info";
  icon: LucideIcon;
  trend?: string;
  chart?: number[];
  chartLabel?: string;
  chartMode?: "line" | "bars";
};

const defaultCharts: Record<NonNullable<StatCardProps["tone"]>, number[]> = {
  positive: [34, 42, 38, 56, 62, 70, 78, 86],
  warning: [62, 58, 65, 52, 48, 55, 50, 44],
  danger: [78, 70, 75, 66, 58, 63, 52, 48],
  info: [38, 46, 44, 54, 60, 58, 66, 74],
};

export function StatCard({ label, value, note, tone = "info", icon: Icon, trend, chart, chartLabel, chartMode = "line" }: StatCardProps) {
  const series = chart && chart.length > 0 ? chart : defaultCharts[tone];
  const hasMovement = series.some((item) => Math.abs(item) > 0);

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
      <div className={`stat-card-visual stat-card-visual-${chartMode}`} aria-label={chartLabel || `Grafico de ${label}`}>
        {chartMode === "bars" ? <BarChart series={series} label={label} /> : <LineChart series={series} label={label} />}
        <span className="stat-chart-caption">{chartLabel || (hasMovement ? "Datos reales" : "Sin movimiento")}</span>
      </div>
      {trend ? <span className={`stat-trend ${tone}`}>{trend}</span> : null}
      <span className="stat-note">{note}</span>
    </article>
  );
}

function LineChart({ label, series }: { label: string; series: number[] }) {
  const points = normalizePoints(series);
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `0,92 ${line} 100,92`;
  return (
    <svg className="stat-chart-svg" viewBox="0 0 100 96" role="img" aria-label={`Tendencia ${label}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`area-${safeId(label)}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.34" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polyline className="stat-chart-grid" points="0,72 100,72" />
      <polygon className="stat-chart-area" points={area} fill={`url(#area-${safeId(label)})`} />
      <polyline className="stat-chart-line" points={line} />
      {points.map((point, index) => (
        <circle className="stat-chart-dot" cx={point.x} cy={point.y} r={index === points.length - 1 ? 2.7 : 1.7} key={`${label}-${index}`} />
      ))}
    </svg>
  );
}

function BarChart({ label, series }: { label: string; series: number[] }) {
  const max = Math.max(...series.map((value) => Math.abs(value)), 1);
  const width = Math.max(7, Math.min(16, 72 / Math.max(series.length, 1)));
  const gap = series.length > 1 ? (100 - width * series.length) / (series.length + 1) : 38;
  return (
    <svg className="stat-chart-svg" viewBox="0 0 100 96" role="img" aria-label={`Comparativa ${label}`} preserveAspectRatio="none">
      <polyline className="stat-chart-grid" points="0,72 100,72" />
      {series.map((value, index) => {
        const height = 10 + (Math.abs(value) / max) * 62;
        const x = gap + index * (width + gap);
        const y = 72 - height;
        return <rect className="stat-chart-bar" x={x} y={y} width={width} height={height} rx="3" key={`${label}-${index}`} />;
      })}
    </svg>
  );
}

function normalizePoints(values: number[]) {
  const series = values.length > 1 ? values : [0, values[0] || 0, values[0] || 0];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = Math.max(max - min, Math.max(Math.abs(max), 1));
  return series.map((value, index) => ({
    x: series.length === 1 ? 50 : (index / (series.length - 1)) * 100,
    y: 78 - ((value - min) / range) * 56,
  }));
}

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
