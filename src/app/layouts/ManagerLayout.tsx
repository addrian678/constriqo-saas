import { useState, type ReactNode } from "react";
import type { DemoRole } from "../../core/types/roles";
import { managerNavigation } from "../../verticals/construction/navigation/roleNavigation";
import { AppShell } from "./AppShell";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

type ManagerLayoutProps = {
  children: ReactNode;
  onRoleChange: (role: DemoRole | null) => void;
};

export function ManagerLayout({ children, onRoleChange }: ManagerLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <AppShell>
      <div className="workspace">
        {menuOpen ? (
          <button className="mobile-sidebar-backdrop" type="button" onClick={() => setMenuOpen(false)} aria-label="Cerrar menu" />
        ) : null}
        <div className={`mobile-sidebar ${menuOpen ? "open" : ""}`}>
          <Sidebar items={managerNavigation} sectionLabel="Gestor de empresa" onNavigate={() => setMenuOpen(false)} />
        </div>
        <div className="main-column">
          <Topbar activeRole="manager" onRoleChange={onRoleChange} onOpenMenu={() => setMenuOpen(true)} />
          <main className="content">{children}</main>
        </div>
      </div>
    </AppShell>
  );
}
