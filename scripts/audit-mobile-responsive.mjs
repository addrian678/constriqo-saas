import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function readProjectFile(path) {
  const fullPath = join(root, path);
  check(`Archivo requerido ${path}`, existsSync(fullPath), path);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

const css = readProjectFile("src/styles/globals.css");
const workspace = readProjectFile("src/app/ProductionWorkspace.tsx");
const workerWorkspace = readProjectFile("src/app/WorkerProductionWorkspace.tsx");
const estimatesPage = readProjectFile("src/modules/estimates/pages/EstimatesRealPage.tsx");
const invoicingPage = readProjectFile("src/modules/invoicing/pages/InvoicingRealPage.tsx");
const runbook = readProjectFile("docs/runbooks/pwa-android-readiness.md");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("Workspace admin usa drawer movil", workspace.includes("production-drawer-button") && workspace.includes("production-mobile-drawer"), "admin drawer");
check("Workspace cierra drawer al seleccionar", workspace.includes("setDrawerOpen(false)") && workspace.includes("selectModule"), "drawer close");
check("Worker conserva acciones moviles principales", workerWorkspace.includes("production-topbar") && workerWorkspace.includes("worker-actions") && workerWorkspace.includes("Cerrar sesion"), "worker mobile actions");

check("CSS oculta overflow horizontal global", css.includes("overflow-x: hidden") && css.includes(".app-shell") && css.includes("overflow-x: hidden;"), "overflow shell");
check("CSS tiene breakpoint tablet", css.includes("@media (max-width: 920px)") && css.includes(".production-tabs-desktop") && css.includes("display: none"), "tablet drawer");
check("CSS tiene breakpoint movil 640", css.includes("@media (max-width: 640px)") && css.includes(".production-topbar") && css.includes("grid-template-columns: 42px minmax(0, 1fr)"), "mobile topbar");
check("Drawer movil scrollea", css.includes("height: 100dvh") && css.includes("overflow-y: auto") && css.includes("overscroll-behavior: contain"), "drawer scroll");
check("Drawer movil no corta botones", css.includes(".production-mobile-drawer .production-tabs button") && css.includes("white-space: normal"), "drawer labels");
check("Tablas responsive controlan overflow", css.includes(".responsive-table") && css.includes("overflow-x: auto") && css.includes("-webkit-overflow-scrolling: touch"), "tables");
check("Tablas colapsan en movil", css.includes(".documents-table-grid") && css.includes(".finance-table-grid") && css.includes("grid-template-columns: 1fr"), "mobile grids");
check("Botones no desbordan", css.includes(".button") && css.includes("max-width: 100%") && css.includes("white-space: normal"), "buttons");
check("Formularios no fuerzan ancho", css.includes(".input") && css.includes("min-width: 0") && css.includes(".form-control"), "forms");
check("Partidas moviles conservan contexto visible", css.includes(".line-item-mobile-heading") && estimatesPage.includes("Partida {index + 1}") && invoicingPage.includes("Partida {index + 1}"), "mobile line item labels");
check("Campos numericos moviles tienen aria-label", estimatesPage.includes("aria-label={`Cantidad de partida") && invoicingPage.includes("aria-label={`Precio unitario de partida"), "mobile numeric labels");
check("Acciones segmentadas envuelven", css.includes(".segmented-actions") && css.includes("flex-wrap: wrap") && css.includes("flex: 1 1 180px"), "actions wrap");
check("Textos largos rompen palabra en movil", css.includes("overflow-wrap: anywhere") && css.includes(".status-badge"), "long text");
check("Page title no usa vw", !/font-size:\s*clamp\([^;]*vw/iu.test(css) && !/font-size:\s*[^;]*vw/iu.test(css), "no vw font");

check("Runbook exige auditoria movil", runbook.includes("360 px") && runbook.includes("390 px") && runbook.includes("tablet"), "runbook viewports");
check("Package script audit:mobile-responsive", Boolean(packageJson.scripts?.["audit:mobile-responsive"]), "script");
check("Verify incluye audit:mobile-responsive", String(packageJson.scripts?.verify).includes("audit:mobile-responsive"), "verify");

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Mobile responsive audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Mobile responsive audit passed with ${checks.length} checks.`);
