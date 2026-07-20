import { Hammer } from "lucide-react";
import { PageHeader } from "./PageHeader";

type ComingSoonPageProps = {
  moduleName: string;
  roleLabel: string;
};

export function ComingSoonPage({ moduleName, roleLabel }: ComingSoonPageProps) {
  return (
    <>
      <PageHeader
        eyebrow={roleLabel}
        title={moduleName}
        description="Modulo preparado para una fase posterior. En V0.1 solo se deja la ruta, el espacio visual y la navegacion."
      />
      <section className="coming-soon">
        <div className="coming-soon-inner">
          <span className="stat-icon warning" style={{ margin: "0 auto 14px" }}>
            <Hammer size={22} />
          </span>
          <h2 className="card-title">Preparado para evolucionar</h2>
          <p className="page-description">
            Esta pantalla no contiene formularios, integraciones, persistencia ni logica de negocio.
          </p>
        </div>
      </section>
    </>
  );
}
