import type { DemoRole } from "../types/roles";

export type ModuleManifest = {
  id: string;
  label: string;
  version: string;
  routes: string[];
  navigationRoles: DemoRole[];
  capabilities: string[];
  dependencies: string[];
  featureFlag: string;
  phase: string;
};
