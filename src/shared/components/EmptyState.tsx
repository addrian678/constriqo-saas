import { ClipboardList } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <div className="empty-state-inner">
        <span className="stat-icon info" style={{ margin: "0 auto 14px" }}>
          <ClipboardList size={22} />
        </span>
        <h2 className="card-title">{title}</h2>
        <p className="page-description">{description}</p>
      </div>
    </section>
  );
}
