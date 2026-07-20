import type { StatusTone } from "../../core/types/status";
import { StatusBadge } from "./StatusBadge";

type AlertCardProps = {
  title: string;
  text: string;
  badge: string;
  tone?: StatusTone;
};

export function AlertCard({ title, text, badge, tone = "warning" }: AlertCardProps) {
  return (
    <article className="alert-card">
      <div className="alert-heading">
        <h3 className="alert-title">{title}</h3>
        <StatusBadge label={badge} tone={tone} />
      </div>
      <p className="alert-text">{text}</p>
    </article>
  );
}
