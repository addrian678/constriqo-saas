import type { ModuleManifest } from "../../../src/core/contracts/moduleManifest";
import type { ApiRouteContract } from "./httpTypes";

export type BackendModuleContract = {
  manifest: ModuleManifest;
  apiPrefix: string;
  routes: ApiRouteContract[];
  persistence: "not-configured" | "prepared" | "active";
  audit: "required" | "optional";
};

export function createReadRoute(moduleId: string, path: string, capability: string, handlerName: string): ApiRouteContract {
  return {
    method: "GET",
    path,
    moduleId,
    capability,
    handlerName,
    authRequired: true,
    auditEvent: `${moduleId}.read`,
  };
}
