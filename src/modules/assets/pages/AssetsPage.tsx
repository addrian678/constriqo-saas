import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Package, Search, ShieldCheck, Wrench } from "lucide-react";
import { visualDocuments } from "../../documents/mock-data/documentsData";
import { jobs } from "../../jobs/mock-data/jobsData";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatCard } from "../../../shared/components/StatCard";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { assets, assetsSummary, type AssetStatus, type MaintenanceStatus } from "../mock-data/assetsData";

const assetTone: Record<AssetStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Operativo: "success",
  "Mantenimiento programado": "warning",
  "Fuera de servicio": "danger",
  "Garantia por vencer": "info",
};

const maintenanceTone: Record<MaintenanceStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  Programado: "warning",
  "Completado visual": "success",
  "Requiere revision": "danger",
};

type AssetsPageProps = {
  basePath: "/admin/activos";
  roleLabel: "Administrador";
};

export function AssetsPage({ basePath, roleLabel }: AssetsPageProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AssetStatus | "Todos">("Todos");

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return assets.filter((asset) => {
      const job = jobs.find((item) => item.jobId === asset.assignedJobId);
      const matchesQuery =
        !normalizedQuery ||
        [asset.code, asset.name, asset.category, asset.status, asset.custodian, job?.title || ""].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      const matchesStatus = status === "Todos" || asset.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status]);

  const nextMaintenance = assets.flatMap((asset) =>
    asset.maintenance.map((item) => ({
      ...item,
      assetName: asset.name,
      assetCode: asset.code,
    })),
  );

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel} - V0.12`}
        title="Activos"
        description="Inventario visual de equipos, vehiculos, herramientas, depreciacion manual, mantenimiento, garantias y documentos vinculados."
      />

      <section className="grid stats-grid">
        <StatCard label="Valor en libros" value={assetsSummary.activeValue} note="Manual visual" tone="positive" icon={Package} />
        <StatCard label="Depreciacion" value={assetsSummary.depreciation} note="Sin calculo real" tone="warning" icon={CalendarClock} />
        <StatCard label="Mantenimientos" value={assetsSummary.maintenanceDue} note="Agenda visual" tone="info" icon={Wrench} />
        <StatCard label="Garantias" value={assetsSummary.warrantiesDue} note="Por revisar" tone="danger" icon={ShieldCheck} />
      </section>

      <section className="grid two-column" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-title-row">
            <div>
              <h2 className="card-title">Inventario de activos</h2>
              <p className="activity-meta">Depreciacion, ubicacion y responsables son datos simulados.</p>
            </div>
            <StatusBadge label="V0.12 visual" tone="info" />
          </div>
          <div className="filters-row">
            <label className="search-box crm-search">
              <Search size={18} />
              <input
                aria-label="Buscar activos"
                placeholder="Buscar por codigo, equipo, responsable u obra"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="form-control filter-control">
              <span className="visual-field-label">Estado</span>
              <select className="select" value={status} onChange={(event) => setStatus(event.target.value as AssetStatus | "Todos")}>
                <option>Todos</option>
                <option>Operativo</option>
                <option>Mantenimiento programado</option>
                <option>Fuera de servicio</option>
                <option>Garantia por vencer</option>
              </select>
            </label>
          </div>

          {filteredAssets.length > 0 ? (
            <div className="responsive-table" style={{ marginTop: 16 }}>
              <div className="table-header assets-table-grid">
                <span>Activo</span>
                <span>Ubicacion</span>
                <span>Estado</span>
                <span>Valor</span>
                <span>Accion</span>
              </div>
              {filteredAssets.map((asset) => {
                const job = jobs.find((item) => item.jobId === asset.assignedJobId);
                return (
                  <article className="table-row assets-table-grid" key={asset.assetId}>
                    <div>
                      <strong>{asset.code}</strong>
                      <p className="activity-meta">{asset.name}</p>
                    </div>
                    <div>
                      <strong>{asset.location}</strong>
                      <p className="activity-meta">{job?.jobNumber}</p>
                    </div>
                    <StatusBadge label={asset.status} tone={assetTone[asset.status]} />
                    <strong>{asset.bookValueVisual}</strong>
                    <Link className="button button-secondary" to={`${basePath}/${asset.assetId}`}>
                      Ver detalle
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Sin activos" description="No hay resultados para los filtros actuales." />
          )}
        </div>

        <div className="card">
          <div className="card-title-row">
            <h2 className="card-title">Mantenimientos y garantias</h2>
            <Wrench size={20} />
          </div>
          <div className="grid">
            {nextMaintenance.map((item) => (
              <article className="alert-card" key={item.maintenanceId}>
                <div className="alert-heading">
                  <h3 className="alert-title">{item.assetCode}</h3>
                  <StatusBadge label={item.status} tone={maintenanceTone[item.status]} />
                </div>
                <p className="alert-text">{item.date} - {item.assetName} - {item.type}</p>
              </article>
            ))}
            {visualDocuments.slice(2, 5).map((document) => (
              <article className="alert-card" key={document.documentId}>
                <div className="alert-heading">
                  <h3 className="alert-title">{document.type}</h3>
                  <StatusBadge label={document.status} tone={document.status === "Por vencer" ? "warning" : "neutral"} />
                </div>
                <p className="alert-text">{document.title}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
