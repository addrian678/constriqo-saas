import type { ApiRouteContract } from "../core/httpTypes";
import type { BackendModuleContract } from "../core/moduleBackendContract";
import { backendModules } from "../modules/backendModules";

export type ServerAppContract = {
  name: string;
  version: string;
  modules: BackendModuleContract[];
  routes: ApiRouteContract[];
  health: {
    status: "ready-for-runtime" | "degraded";
    persistence: "not-configured" | "prepared" | "active";
  };
};

export function createServerApp(modules: BackendModuleContract[] = backendModules): ServerAppContract {
  return {
    name: "Constriqo API",
    version: "F1.2-contract",
    modules,
    routes: modules.flatMap((module) => module.routes),
    health: {
      status: "ready-for-runtime",
      persistence: "not-configured",
    },
  };
}
