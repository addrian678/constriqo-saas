import { appConfig } from "../../../app/config/appConfig";
import type { DemoRole } from "../../../core/types/roles";
import { company, roleProfiles } from "../../../mock-data/company";
import { workforceMembers } from "../../workforce/mock-data/workforceData";

export type VisualUserStatus = "Activo visual" | "Invitacion pendiente" | "Suspendido visual";
export type VisualRoleScope = "Global" | "Operativo" | "Campo";
export type VisualSettingStatus = "Activo" | "Preparado" | "Bloqueado en V0";

export type VisualUser = {
  userId: string;
  name: string;
  email: string;
  role: DemoRole;
  status: VisualUserStatus;
  lastSeen: string;
  relatedWorkerId?: string;
  notes: string;
};

export type VisualRole = {
  role: DemoRole;
  label: string;
  scope: VisualRoleScope;
  description: string;
  capabilities: string[];
  restrictedAreas: string[];
};

export type CompanySetting = {
  settingId: string;
  label: string;
  value: string;
  status: VisualSettingStatus;
  group: "Empresa" | "Localizacion" | "Modulos" | "Seguridad";
};

export const visualUsers: VisualUser[] = [
  {
    userId: "user-001",
    name: roleProfiles.admin.userName,
    email: "maria.torres@example.test",
    role: "admin",
    status: "Activo visual",
    lastSeen: "Jul 14, 2026 08:44",
    notes: "Perfil demo con acceso administrativo completo en maqueta.",
  },
  {
    userId: "user-002",
    name: roleProfiles.manager.userName,
    email: "david.herrera@example.test",
    role: "manager",
    status: "Activo visual",
    lastSeen: "Jul 14, 2026 08:31",
    notes: "Gestor operativo sin acceso visual a pasivos ni configuracion.",
  },
  {
    userId: "user-003",
    name: roleProfiles.worker.userName,
    email: "carlos.mendoza@example.test",
    role: "worker",
    status: "Activo visual",
    lastSeen: "Jul 14, 2026 08:25",
    relatedWorkerId: workforceMembers[0].workerId,
    notes: "Trabajador vinculado a ficha de personal y app movil.",
  },
  {
    userId: "user-004",
    name: "Sofia Medina",
    email: "sofia.medina@example.test",
    role: "manager",
    status: "Invitacion pendiente",
    lastSeen: "Sin acceso",
    notes: "Invitacion visual; no se envia correo ni token real.",
  },
  {
    userId: "user-005",
    name: "Kevin Morales",
    email: "kevin.morales@example.test",
    role: "worker",
    status: "Suspendido visual",
    lastSeen: "Jul 10, 2026 16:10",
    relatedWorkerId: workforceMembers[3].workerId,
    notes: "Suspension visual para validar estados de acceso.",
  },
];

export const visualRoles: VisualRole[] = [
  {
    role: "admin",
    label: "Administrador",
    scope: "Global",
    description: "Control total visual de empresa, finanzas, usuarios, auditoria y configuracion.",
    capabilities: [
      "dashboard.read",
      "crm.read",
      "estimates.read",
      "jobs.read",
      "workforce.read",
      "finance.read",
      "assets.read",
      "organization.read",
      "audit.read.visual",
    ],
    restrictedAreas: [],
  },
  {
    role: "manager",
    label: "Gestor de empresa",
    scope: "Operativo",
    description: "Gestion operativa de clientes, obras, personal, partes diarios, documentos e informes autorizados.",
    capabilities: [
      "crm.read",
      "estimates.read",
      "jobs.read",
      "workforce.read",
      "attendance.review.visual",
      "documents.read",
      "reports.read.visual",
    ],
    restrictedAreas: ["Pasivos", "Configuracion", "Usuarios y roles", "Auditoria"],
  },
  {
    role: "worker",
    label: "Trabajador",
    scope: "Campo",
    description: "Acceso movil a jornada, trabajos asignados, evidencias, historial de horas y avisos.",
    capabilities: [
      "worker.home.read",
      "attendance.self.visual",
      "assignments.self.read",
      "proofs.self.visual",
      "notifications.self.read",
    ],
    restrictedAreas: ["CRM", "Finanzas", "Gastos", "Activos", "Pasivos", "Documentos administrativos"],
  },
];

export const companySettings: CompanySetting[] = [
  {
    settingId: "setting-001",
    label: "Empresa",
    value: company.name,
    status: "Activo",
    group: "Empresa",
  },
  {
    settingId: "setting-002",
    label: "Ubicacion",
    value: company.location,
    status: "Activo",
    group: "Empresa",
  },
  {
    settingId: "setting-003",
    label: "Moneda",
    value: appConfig.currency,
    status: "Activo",
    group: "Localizacion",
  },
  {
    settingId: "setting-004",
    label: "Idioma de interfaz",
    value: appConfig.locale.interfaceLanguage,
    status: "Activo",
    group: "Localizacion",
  },
  {
    settingId: "setting-005",
    label: "Zona horaria",
    value: appConfig.locale.timezone,
    status: "Activo",
    group: "Localizacion",
  },
  {
    settingId: "setting-006",
    label: "Perfil activo",
    value: appConfig.activeIndustryProfile,
    status: "Activo",
    group: "Modulos",
  },
  {
    settingId: "setting-007",
    label: "Perfil preparado",
    value: appConfig.preparedIndustryProfiles.join(", "),
    status: "Preparado",
    group: "Modulos",
  },
  {
    settingId: "setting-008",
    label: "Autenticacion real",
    value: "Deshabilitada en V0.14",
    status: "Bloqueado en V0",
    group: "Seguridad",
  },
  {
    settingId: "setting-009",
    label: "Invitaciones",
    value: "Simuladas",
    status: "Bloqueado en V0",
    group: "Seguridad",
  },
];

export const moduleToggles = appConfig.enabledModules.map((moduleId) => ({
  moduleId,
  label: moduleId,
  status: "Activo visual" as const,
}));

export const organizationSummary = {
  users: String(visualUsers.length),
  activeUsers: "3",
  pendingInvites: "1",
  roles: String(visualRoles.length),
};
