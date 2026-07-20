import type { ModuleManifest } from "../../core/contracts/moduleManifest";

export const documentsModuleManifest: ModuleManifest = {
  id: "documents",
  label: "Documentos y archivos",
  version: "0.8.0-visual",
  routes: ["/admin/documentos", "/admin/documentos/:documentId", "/manager/documentos", "/manager/documentos/:documentId"],
  navigationRoles: ["admin", "manager"],
  capabilities: ["documents.read", "documents.review", "documents.link.visual", "documents.expirations.read"],
  dependencies: ["crm", "estimates", "jobs", "workforce", "permissions"],
  featureFlag: "documents",
  phase: "V0.8",
};
