export type DemoRole = "admin" | "manager" | "worker" | "super_admin";

export type RoleProfile = {
  id: DemoRole;
  label: string;
  userName: string;
  roleName: string;
  initials: string;
};
