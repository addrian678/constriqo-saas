import type { RoleProfile } from "../core/types/roles";

export const company = {
  name: "Canyon Build Services LLC",
  location: "Utah, United States",
};

export const roleProfiles: Record<RoleProfile["id"], RoleProfile> = {
  admin: {
    id: "admin",
    label: "Administrador",
    userName: "Maria Torres",
    roleName: "Administrador",
    initials: "MT",
  },
  manager: {
    id: "manager",
    label: "Gestor de empresa",
    userName: "David Herrera",
    roleName: "Gestor de empresa",
    initials: "DH",
  },
  worker: {
    id: "worker",
    label: "Trabajador",
    userName: "Carlos Mendoza",
    roleName: "Trabajador",
    initials: "CM",
  },
  super_admin: {
    id: "super_admin",
    label: "Super Admin",
    userName: "Proveedor Constriqo",
    roleName: "Super Admin proveedor",
    initials: "CF",
  },
};

export const projects = [
  "Kitchen Renovation - Salt Lake City",
  "Basement Remodeling - West Jordan",
  "Bathroom Renovation - Provo",
  "Deck Construction - Draper",
];

export const workers = ["Carlos Mendoza", "Daniel Rivera", "Jose Ramirez", "Kevin Morales"];
