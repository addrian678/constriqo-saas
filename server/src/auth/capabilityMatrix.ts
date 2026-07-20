import type { DemoRole } from "../../../src/core/types/roles";
import { moduleRegistry } from "../../../src/core/modules/moduleRegistry";

export type RoleCapabilityMatrix = Record<DemoRole, string[]>;

const allCapabilities = Array.from(new Set(moduleRegistry.flatMap((manifest) => manifest.capabilities)));

export const roleCapabilityMatrix: RoleCapabilityMatrix = {
  admin: allCapabilities,
  manager: Array.from(
    new Set(
      moduleRegistry
        .filter((manifest) => manifest.navigationRoles.includes("manager"))
        .flatMap((manifest) => manifest.capabilities)
        .filter((capability) => !capability.includes("liabilities") && !capability.includes("organization")),
    ),
  ),
  worker: Array.from(
    new Set(
      moduleRegistry
        .filter((manifest) => manifest.navigationRoles.includes("worker"))
        .flatMap((manifest) => manifest.capabilities)
        .concat(["notifications.self.read", "attendance.self.visual", "assignments.self.read", "proofs.self.visual"]),
    ),
  ),
  super_admin: ["superadmin.read", "superadmin.manage"],
};

export function getCapabilitiesForRoles(roles: DemoRole[]): string[] {
  return Array.from(new Set(roles.flatMap((role) => roleCapabilityMatrix[role])));
}

export function roleHasCapability(role: DemoRole, capability: string): boolean {
  return roleCapabilityMatrix[role].includes(capability);
}
