import { useLocation } from "react-router-dom";
import { ProductionApp } from "./ProductionApp";

const PROVIDER_CONSOLE_PATH = "/acceso-admi-proveedor-constriqo";
const LEGACY_PROVIDER_CONSOLE_PATH = "/super-admin";
const PROVIDER_CONSOLE_HOSTS = new Set(["admin.constriqo.com"]);

export function App() {
  const location = useLocation();
  const hostname = window.location.hostname.toLowerCase();
  const isProviderHost = PROVIDER_CONSOLE_HOSTS.has(hostname);
  const isProviderEntry = location.pathname.startsWith(PROVIDER_CONSOLE_PATH);
  const isLegacyProviderEntry = location.pathname.startsWith(LEGACY_PROVIDER_CONSOLE_PATH);

  if (isProviderHost || isProviderEntry) {
    return <ProductionApp entry="super-admin" />;
  }

  if (isLegacyProviderEntry) {
    return (
      <main className="app-shell production-shell">
        <section className="content">
          <div className="login-panel">
            <h1>404</h1>
            <p className="activity-meta">Pagina no encontrada.</p>
          </div>
        </section>
      </main>
    );
  }

  return <ProductionApp entry="tenant" />;
}
