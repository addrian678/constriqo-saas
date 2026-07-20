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

const preflight = readProjectFile("scripts/production-preflight.mjs");
const runbook = readProjectFile("docs/runbooks/domain-supabase-email-storage.md");
const plan = readProjectFile("docs/product-delivery-update-security-plan.md");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("Preflight existe", preflight.includes("REQUIRED_MIGRATION") && preflight.includes("0055_supabase_readiness_schema_migrations_rls.sql"), "migration");
check("Preflight valida dominio HTTPS", preflight.includes("APP_BASE_URL usa HTTPS") && preflight.includes("VITE_API_BASE_URL"), "https");
check("Preflight valida dominios SaaS permitidos", preflight.includes("APP_ALLOWED_ORIGIN_DOMAINS configurado") && preflight.includes("hasAllowedOriginDomains"), "allowed origins");
check("Preflight valida secretos base", preflight.includes("SESSION_TOKEN_PEPPER") && preflight.includes("AUTH_MFA_ENCRYPTION_KEY"), "secrets");
check("Preflight valida DB y migracion", preflight.includes("schema_migrations") && preflight.includes("DATABASE_URL runtime"), "db");
check("Preflight valida email", preflight.includes("EMAIL_PROVIDER real") && preflight.includes("SMTP_PASSWORD") && preflight.includes("EMAIL_DELIVERY_WORKER_ENABLED"), "email");
check("Preflight valida storage", preflight.includes("STORAGE_PROVIDER real") && preflight.includes("SUPABASE_SERVICE_ROLE_KEY"), "storage");
check("Preflight redacta secretos", preflight.includes("safeRedact") && !preflight.includes("console.log(process.env"), "redaction");
check("Runbook documenta preflight", runbook.includes("npm run production:preflight") && runbook.includes("APP_ENV=\"staging\""), "runbook");
check("Plan documenta A5", plan.includes("Actualizacion A5") && plan.includes("production:preflight"), "plan");
check("Package registra production:preflight", Boolean(packageJson.scripts?.["production:preflight"]), "script");
check("Package registra audit:production-preflight", Boolean(packageJson.scripts?.["audit:production-preflight"]) && String(packageJson.scripts?.verify).includes("audit:production-preflight"), "audit");

if (failures > 0) {
  console.error(`Production preflight audit failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log("Production preflight audit passed.");
