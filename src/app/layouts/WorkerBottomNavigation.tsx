import { NavLink } from "react-router-dom";
import { Briefcase, CalendarClock, ClipboardCheck, Home, MoreHorizontal } from "lucide-react";

const bottomItems = [
  { label: "Inicio", path: "/worker/inicio", icon: Home },
  { label: "Jornada", path: "/worker/mi-jornada", icon: CalendarClock },
  { label: "Trabajos", path: "/worker/trabajos-asignados", icon: Briefcase },
  { label: "Pruebas", path: "/worker/pruebas-de-trabajo", icon: ClipboardCheck },
  { label: "Mas", path: "/worker/notificaciones", icon: MoreHorizontal },
];

export function WorkerBottomNavigation() {
  return (
    <nav className="worker-bottom-nav" aria-label="Navegacion del trabajador">
      {bottomItems.map((item) => (
        <NavLink className={({ isActive }) => `worker-bottom-link ${isActive ? "active" : ""}`} key={item.path} to={item.path}>
          <item.icon size={22} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
