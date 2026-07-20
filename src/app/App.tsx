import { useLocation } from "react-router-dom";
import { ProductionApp } from "./ProductionApp";

export function App() {
  const location = useLocation();
  const isSuperAdminEntry = location.pathname.startsWith("/super-admin");

  if (isSuperAdminEntry) {
    return <ProductionApp entry="super-admin" />;
  }

  return <ProductionApp entry="tenant" />;
}
