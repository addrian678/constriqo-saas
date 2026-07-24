import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function read(relativePath) {
  const file = join(root, relativePath);
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

function check(name, passed, detail = "") {
  checks.push({ name, passed, detail });
}

const packageJson = JSON.parse(read("package.json") || "{}");
const monitor = read("scripts/production-health-check.mjs");
const storageSmoke = read("scripts/storage-production-smoke.mjs");
const finalRunbook = read("docs/runbooks/production-finalization.md");
const operationsRunbook = read("docs/runbooks/operations-readiness.md");
const operationsRunbookLower = operationsRunbook.toLowerCase();
const domainRunbook = read("docs/runbooks/constriqo-domain-setup.md");
const pwaRunbook = read("docs/runbooks/pwa-android-readiness.md");

check("Comando monitor productivo registrado", packageJson.scripts?.["monitor:production"] === "node scripts/production-health-check.mjs", "monitor:production");
check("Comando smoke storage productivo registrado", packageJson.scripts?.["smoke:storage-production"] === "node scripts/storage-production-smoke.mjs", "smoke:storage-production");
check("Auditoria final registrada en verify", packageJson.scripts?.["audit:final-readiness"] && packageJson.scripts?.verify.includes("audit:final-readiness"), "verify");
check("Monitor valida health y ready HTTPS", monitor.includes("/health") && monitor.includes("/ready") && monitor.includes("https://api.constriqo.com"), "monitor");
check("Storage smoke usa Supabase service role solo backend", storageSmoke.includes("SUPABASE_SERVICE_ROLE_KEY") && storageSmoke.includes("supabase-storage"), "storage smoke");
check("Storage smoke no toca tablas tenant", !storageSmoke.includes("INSERT INTO") && !storageSmoke.includes("UPDATE "), "storage no db mutation");
check("Runbook final cubre subdominios", finalRunbook.includes("Wildcard DNS") && finalRunbook.includes("tenant_slug"), "subdomains");
check("Runbook final cubre storage real final", finalRunbook.includes("smoke:storage-production") && finalRunbook.includes("bucket privado"), "storage final");
check("Runbook final cubre backup restore real", finalRunbook.includes("db:backup") && finalRunbook.includes("db:restore -- --verify-only"), "backup restore");
check("Runbook final cubre monitoreo externo", finalRunbook.includes("monitor:production") && finalRunbook.includes("Uptime"), "monitoring");
check("Runbook final cubre Android/SMTP futuro", finalRunbook.includes("Android nativo") && finalRunbook.includes("SMTP"), "android smtp");
check("Operations readiness refleja piloto actual", operationsRunbookLower.includes("piloto controlado") && !operationsRunbook.includes("NOT_IMPLEMENTED"), "operations current");
check("Dominio conserva ruta unica Super Admin", domainRunbook.includes("acceso-admi-proveedor-constriqo") && !domainRunbook.includes("admin.constriqo.com"), "super admin route");
check("Android queda native-ready no duplicado", pwaRunbook.includes("native-ready") && pwaRunbook.includes("Capacitor"), "android readiness");

const failed = checks.filter((item) => !item.passed);
for (const item of checks) {
  console.log(`${item.passed ? "ok" : "not ok"} - ${item.name}${item.detail ? ` (${item.detail})` : ""}`);
}

if (failed.length > 0) {
  console.error(`Final readiness audit failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("Final readiness audit passed.");
