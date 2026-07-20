import { useState, type ReactNode } from "react";
import type { DemoRole } from "../../core/types/roles";
import { adminNavigation } from "../../verticals/construction/navigation/roleNavigation";
import { AppShell } from "./AppShell";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

type AdminLayoutProps = {
  children: ReactNode;
  onRoleChange: (role: DemoRole | null) => void;
};

export function AdminLayout({ children, onRoleChange }: AdminLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <AppShell>
      <div className="workspace">
        {menuOpen ? (
          <button className="mobile-sidebar-backdrop" type="button" onClick={() => setMenuOpen(false)} aria-label="Cerrar menu" />
        ) : null}
        <div className={`mobile-sidebar ${menuOpen ? "open" : ""}`}>
          <Sidebar items={adminNavigation} sectionLabel="Administrador" onNavigate={() => setMenuOpen(false)} />
        </div>
        <div className="main-column">
          <Topbar activeRole="admin" onRoleChange={onRoleChange} onOpenMenu={() => setMenuOpen(true)} />
          <main className="content">{children}</main>
        </div>
      </div>
    </AppShell>
  );
}
