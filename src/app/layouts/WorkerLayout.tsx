import type { ReactNode } from "react";
import { Bell, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import type { DemoRole } from "../../core/types/roles";
import { roleProfiles } from "../../mock-data/company";
import { brand } from "../../branding/brand";
import { AppShell } from "./AppShell";
import { WorkerBottomNavigation } from "./WorkerBottomNavigation";

type WorkerLayoutProps = {
  children: ReactNode;
  onRoleChange: (role: DemoRole | null) => void;
};

export function WorkerLayout({ children, onRoleChange }: WorkerLayoutProps) {
  const profile = roleProfiles.worker;

  return (
    <AppShell>
      <div className="worker-shell">
        <header className="worker-top">
          <div className="brand-lockup" style={{ marginBottom: 0 }}>
            <span className="brand-mark">{brand.mark}</span>
            <div>
              <p className="brand-name">{brand.name}</p>
              <p className="brand-subtitle">{profile.roleName}</p>
            </div>
          </div>
          <div className="topbar-right">
            <Link className="icon-button" to="/worker/notificaciones" aria-label="Notificaciones">
              <Bell size={19} />
            </Link>
            <button className="icon-button" type="button" onClick={() => onRoleChange(null)} aria-label="Cambiar rol">
              <LogOut size={19} />
            </button>
          </div>
        </header>
        <main className="worker-content">{children}</main>
        <WorkerBottomNavigation />
      </div>
    </AppShell>
  );
}
