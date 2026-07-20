import { Circle } from "lucide-react";
import type { StatusTone } from "../../core/types/status";

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-${tone}`}>
      <Circle size={8} fill="currentColor" />
      {label}
    </span>
  );
}
