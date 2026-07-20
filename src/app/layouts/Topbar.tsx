import { Bell, Building2, ChevronDown, Menu, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { company, roleProfiles } from "../../mock-data/company";
import type { DemoRole } from "../../core/types/roles";
import { RoleDemoSwitcher } from "../../shared/components/RoleDemoSwitcher";

type TopbarProps = {
  activeRole: DemoRole;
  onRoleChange: (role: DemoRole | null) => void;
  onOpenMenu: () => void;
};

export function Topbar({ activeRole, onRoleChange, onOpenMenu }: TopbarProps) {
  const profile = roleProfiles[activeRole];

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button mobile-menu-button" type="button" onClick={onOpenMenu} aria-label="Abrir menu">
          <Menu size={20} />
        </button>
        <div className="search-box">
          <Search size={18} />
          <input aria-label="Buscar" placeholder="Buscar modulo, obra o trabajador" />
        </div>
      </div>
      <div className="topbar-right">
        <div className="company-switcher">
          <Building2 size={18} />
          {company.name}
          <ChevronDown size={16} />
        </div>
        <Link className="icon-button" to={`/${activeRole}/notificaciones`} aria-label="Notificaciones">
          <Bell size={19} />
        </Link>
        <RoleDemoSwitcher activeRole={activeRole} onRoleChange={onRoleChange} />
        <div className="user-chip">
          <span className="avatar">{profile.initials}</span>
          <span>
            <span className="user-name">{profile.userName}</span>
            <span className="user-role">{profile.roleName}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
