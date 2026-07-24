import { NavLink } from "react-router-dom";
import type { NavigationItem } from "../navigation/navigationTypes";
import { brand } from "../../branding/brand";

type SidebarProps = {
  items: NavigationItem[];
  sectionLabel: string;
  onNavigate?: () => void;
};

export function Sidebar({ items, sectionLabel, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <img className="brand-logo-image brand-logo-official" src={brand.logoUrl} alt="" />
        <div>
          <p className="brand-name">{brand.name}</p>
          <p className="brand-subtitle">{brand.tagline}</p>
        </div>
      </div>
      <p className="nav-section-label">{sectionLabel}</p>
      <nav aria-label={sectionLabel}>
        <ul className="nav-list">
          {items.map((item) => (
            <li key={item.path}>
              <NavLink
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                end={item.end}
                onClick={onNavigate}
                to={item.path}
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
