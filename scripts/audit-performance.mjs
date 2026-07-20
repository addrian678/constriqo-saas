import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
let failures = 0;

function readProjectFile(relativePath) {
  const absolutePath = join(root, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`ok - ${name}`);
    return;
  }
  failures += 1;
  console.error(`not ok - ${name}${detail ? ` (${detail})` : ""}`);
}

const packageJson = JSON.parse(readProjectFile("package.json"));
const productionApp = readProjectFile("src/app/ProductionApp.tsx");
const productionWorkspace = readProjectFile("src/app/ProductionWorkspace.tsx");

check("Package registra auditoria performance", Boolean(packageJson.scripts?.["audit:performance"]), "audit:performance");
check("Verify incluye auditoria performance", String(packageJson.scripts?.verify || "").includes("audit:performance"), "verify");
check("Login carga workspaces de forma diferida", productionApp.includes("lazy(() => import(\"./ProductionWorkspace\")") && productionApp.includes("lazy(() => import(\"./WorkerProductionWorkspace\")"), "ProductionApp lazy");
check("Super Admin no entra al bundle inicial tenant", productionApp.includes("lazy(() => import(\"../modules/super-admin/pages/SuperAdminWorkspace\")"), "SuperAdmin lazy");
check("Workspace usa Suspense por modulo", productionWorkspace.includes("<Suspense fallback="), "Suspense");
check("Dashboard se carga diferido", productionWorkspace.includes("lazy(() => import(\"../modules/dashboard/pages/BusinessOverviewRealPage\")"), "dashboard lazy");
check("Modulos pesados no tienen imports estaticos", !/import \{ .*RealPage \} from "\.\.\/modules\//u.test(productionWorkspace), "static RealPage imports");
check("Facturacion, documentos y ajustes son chunks separados", ["InvoicingRealPage", "DocumentsRealPage", "TenantSettingsRealPage"].every((name) => productionWorkspace.includes(`default: module.${name}`)), "module chunks");

if (failures > 0) {
  console.error(`Performance audit failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log("Performance audit passed.");
