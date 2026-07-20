import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, Landmark, Search, WalletCards } from "lucide-react";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import {
  assets,
  liabilities,
  liabilitiesSummary,
  type LiabilityStatus,
  type ObligationStatus,
} from "../mock-data/assetsData";

const liabilityTone: Record<LiabilityStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  "Al dia": "success",
  "Vence pronto": "warning",
  Vencida: "danger",
  "Cerrada visualmente": "neutral",
};

const obligationTone: Record<ObligationStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Pendiente: "warning",
  "Cubierta visual": "success",
  Revisar: "danger",
};

type LiabilitiesPageProps = {
  basePath: "/admin/pasivos";
  roleLabel: "Administrador";
};

export function LiabilitiesPage({ basePath, roleLabel }: LiabilitiesPageProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LiabilityStatus | "Todos">("Todos");

  const filteredLiabilities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return liabilities.filter((liability) => {
      const asset = assets.find((item) => item.assetId === liability.relatedAssetId);
      const matchesQuery =
        !normalizedQuery ||
        [liability.reference, liability.lender, liability.type, liability.status, asset?.name || ""].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      const matchesStatus = status === "Todos" || liability.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status]);

  const upcomingSchedule = liabilities.flatMap((liability) =>
    liability.schedule.map((item) => ({
      ...item,
      reference: liability.reference,
      lender: liability.lender,
    })),
  );

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - V0.12`}
        title="Pasivos y obligaciones"
        description="Deudas, prestamos, cuotas, vencimientos y documentos visuales para seguimiento administrativo. Sin pagos ni amortizacion real."
      />

      <section className="grid stats-grid">
        <StatCard label="Saldo total" value={liabilitiesSummary.totalBalance} note="Visual" tone="warning" icon={WalletCards} />
        <StatCard label="Vence pronto" value={liabilitiesSummary.dueSoon} note="Revision" tone="info" icon={CalendarClock} />
        <StatCard label="Vencido" value={liabilitiesSummary.overdue} note="Sin cobro real" tone="danger" icon={AlertTriangle} />
        <StatCard label="Cuotas" value={liabilitiesSummary.obligations} note="Agenda visual" tone="positive" icon={Landmark} />
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Listado de pasivos</h2>
              <p className="activity-meta">Los saldos y cuotas no alimentan contabilidad ni banco.</p>
            </div>
            <StatusBadge label="V0.12 visual" tone="info" />
          </div>
          <div className="filters-row">
            <label className="search-box crm-search">
              <Search size={18} />
              <input
                aria-label="Buscar pasivos"
                placeholder="Buscar por referencia, entidad, tipo o activo"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="form-control filter-control">
              <span className="visual-field-label">Estado</span>
              <select className="select" value={status} onChange={(event) => setStatus(event.target.value as LiabilityStatus | "Todos")}>
                <option>Todos</option>
                <option>Al dia</option>
                <option>Vence pronto</option>
                <option>Vencida</option>
                <option>Cerrada visualmente</option>
              </select>
            </label>
          </div>

          {filteredLiabilities.length > 0 ? (
            <div className="responsive-table" style={{ marginTop: 16 }}>
              <div className="table-header liabilities-table-grid">
                <span>Pasivo</span>
                <span>Entidad</span>
                <span>Estado</span>
                <span>Saldo</span>
                <span>Accion</span>
              </div>
              {filteredLiabilities.map((liability) => (
                <article className="table-row liabilities-table-grid" key={liability.liabilityId}>
                  <div>
                    <strong>{liability.reference}</strong>
                    <p className="activity-meta">{liability.type}</p>
                  </div>
                  <div>
                    <strong>{liability.lender}</strong>
                    <p className="activity-meta">Proximo: {liability.nextDueDate}</p>
                  </div>
                  <StatusBadge label={liability.status} tone={liabilityTone[liability.status]} />
                  <strong>{liability.balanceVisual}</strong>
                  <Link className="button button-secondary" to={`${basePath}/${liability.liabilityId}`}>
                    Ver detalle
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin pasivos" description="No hay resultados para los filtros actuales." />
          )}
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Agenda de obligaciones</h2>
            <CalendarClock size={20} />
          </div>
          <div className="grid">
            {upcomingSchedule.map((item) => (
              <article className="alert-card" key={item.scheduleId}>
                <div className="alert-heading">
                  <h3 className="alert-title">{item.date}</h3>
                  <StatusBadge label={item.status} tone={obligationTone[item.status]} />
                </div>
                <p className="alert-text">{item.reference} - {item.lender} - {item.amount}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
