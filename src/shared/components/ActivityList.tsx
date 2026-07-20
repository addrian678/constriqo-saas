import { ArrowUpRight } from "lucide-react";
import type { StatusTone } from "../../core/types/status";
import { StatusBadge } from "./StatusBadge";

type ActivityItem = {
  title: string;
  meta: string;
  status: string;
  tone: StatusTone;
};

export function ActivityList({ items }: { items: readonly ActivityItem[] }) {
  return (
    <ul className="activity-list">
      {items.map((item) => (
        <li className="activity-item" key={`${item.title}-${item.meta}`}>
          <span className="activity-icon">
            <ArrowUpRight size={18} />
          </span>
          <div>
            <p className="activity-title">{item.title}</p>
            <p className="activity-meta">{item.meta}</p>
          </div>
          <StatusBadge label={item.status} tone={item.tone} />
        </li>
      ))}
    </ul>
  );
}
