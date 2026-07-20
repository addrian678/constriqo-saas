import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

function readProjectFile(path) {
  const fullPath = join(root, path);
  check(`Archivo requerido ${path}`, existsSync(fullPath), path);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

const migration = readProjectFile("database/migrations/0031_assets_liabilities_runtime.sql");
const repository = readProjectFile("server/runtime/postgresAssetsRepository.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const routes = readProjectFile("server/runtime/runtimeRoutes.mjs");
const manifest = readProjectFile("server/runtime/runtimeManifest.mjs");
const apiClient = readProjectFile("src/modules/assets/api/assetsClient.ts");
const page = readProjectFile("src/modules/assets/pages/AssetsLiabilitiesRealPage.tsx");
const workspace = readProjectFile("src/app/ProductionWorkspace.tsx");
const workerWorkspace = readProjectFile("src/app/WorkerProductionWorkspace.tsx");
const localSmoke = readProjectFile("scripts/assets-local-smoke.mjs");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("Migration registra capacidades", migration.includes("assets.manage") && migration.includes("liabilities.manage"), "capabilities");
check("Migration separa permisos admin/manager", migration.includes("r.code = 'admin'") && migration.includes("r.code = 'manager'"), "role grants");

check("Repository activa tenant context", repository.includes("set_config('app.tenant_id'"), "tenant context");
check("Repository lista activos y pasivos por tenant", repository.includes("WHERE tenant_id = $1") && repository.includes("listLiabilities"), "tenant where");
check("Repository crea activos reales", repository.includes("createAsset") && repository.includes("INSERT INTO assets"), "create asset");
check("Repository crea pasivos reales", repository.includes("createLiability") && repository.includes("INSERT INTO liabilities"), "create liability");
check("Repository genera codigos automaticos", repository.includes("generateAssetCode") && repository.includes("generateLiabilityReference"), "codes");
check("Repository escribe auditoria", repository.includes("INSERT INTO audit_events") && repository.includes("assets-liabilities"), "audit");
check("Repository no toma tenant desde input", !repository.includes("input.tenantId") && !repository.includes("body.tenantId"), "no tenant input");

check("Runtime importa assets repository con pool compartido", server.includes("createPostgresAssetsRepository(sharedPool)"), "shared pool import");
check("Runtime conecta assets-liabilities", server.includes("handleAssetsRoute") && server.includes('route.moduleId === "assets-liabilities"'), "handler");
check("Runtime devuelve 503 si no conectado", server.includes("ASSETS_REPOSITORY_NOT_CONFIGURED"), "503");

check("Rutas GET/POST assets", routes.includes('path: "/api/assets"') && routes.includes('capability: "assets.manage"'), "assets routes");
check("Rutas GET/POST liabilities", routes.includes('path: "/api/liabilities"') && routes.includes('capability: "liabilities.manage"'), "liability routes");
check("Manifest incluye rutas", manifest.includes("/api/assets") && manifest.includes("/api/liabilities"), "manifest");

check("API cubre activos y pasivos", apiClient.includes("listAssets") && apiClient.includes("createLiability"), "api");
check("Pagina no usa mock data", !page.includes("mock-data") && !page.includes("assetsData"), "no mock");
check("Pagina oculta formularios por boton", page.includes("activePanel") && page.includes('activePanel === "asset"') && page.includes('activePanel === "liability"'), "hidden forms");
check("Pagina cierra formulario al guardar", page.includes("setActivePanel(null)") && page.includes("setMessage("), "close and notify");
check("Workspace expone modulo real", workspace.includes("<AssetsLiabilitiesRealPage") && workspace.includes('label: "Activos"'), "workspace");
check("Worker workspace no expone activos", !workerWorkspace.includes("AssetsLiabilitiesRealPage") && !workerWorkspace.includes('label: "Activos"'), "worker isolation");

check("Smoke valida aislamiento", localSmoke.includes("Tenant B no ve activo A") && localSmoke.includes("Tenant B no ve pasivo A"), "isolation smoke");
check("Smoke valida dashboard financiero", localSmoke.includes("Dashboard refleja activo y pasivo"), "dashboard smoke");
check("Package script audit:assets-real", Boolean(packageJson.scripts?.["audit:assets-real"]), "audit script");
check("Package script smoke:assets-local", Boolean(packageJson.scripts?.["smoke:assets-local"]), "smoke script");

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Assets real audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Assets real audit passed with ${checks.length} checks.`);
