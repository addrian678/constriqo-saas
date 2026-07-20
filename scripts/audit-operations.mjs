import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

const requiredFiles = [
  "server/src/operations/healthContracts.ts",
  "server/src/operations/operationsPolicy.ts",
  "docs/runbooks/operations-readiness.md",
  "docs/runbooks/domain-supabase-email-storage.md",
  "docs/runbooks/backup-restore.md",
  "public/manifest.json",
];

for (const file of requiredFiles) {
  check(`Archivo requerido ${file}`, existsSync(join(root, file)), file);
}

const publicSw = join(root, "public/sw.js");
check("Service worker no activado en public", !existsSync(publicSw), "public/sw.js");

const policyPath = join(root, "server/src/operations/operationsPolicy.ts");
if (existsSync(policyPath)) {
  const policy = readFileSync(policyPath, "utf8");
  check("Service worker bloqueado hasta QA", policy.includes('serviceWorker: "disabled-until-qa"'), "serviceWorker");
  check("Offline writes bloqueado", policy.includes('offlineWrites: "disabled-until-conflict-policy"'), "offlineWrites");
  check("Backups requeridos", policy.includes("daily-required-before-production"), "backups");
  check("Rollback requerido", policy.includes('rollbackPlan: "required-before-production"'), "rollback");
}

const productionRunbookPath = join(root, "docs/runbooks/domain-supabase-email-storage.md");
if (existsSync(productionRunbookPath)) {
  const runbook = readFileSync(productionRunbookPath, "utf8");
  check("Runbook cubre dominio HTTPS", runbook.includes("APP_BASE_URL=https://") && runbook.includes("HTTPS obligatorio"), "domain");
  check("Runbook cubre Supabase/PostgreSQL", runbook.includes("MIGRATION_DATABASE_URL") && runbook.includes("db:create-runtime-role"), "supabase db");
  check("Runbook cubre Supabase Storage", runbook.includes("STORAGE_PROVIDER=\"supabase-storage\"") && runbook.includes("SUPABASE_SERVICE_ROLE_KEY"), "storage");
  check("Runbook cubre email real", runbook.includes("EMAIL_PROVIDER=\"smtp\"") && runbook.includes("SPF, DKIM y DMARC"), "email");
  check("Runbook exige proveedores verificados", runbook.includes("EXTERNAL_PROVIDERS_VERIFIED=\"true\"") && runbook.includes("not-ready"), "provider verified");
  check("Runbook cubre fiscalidad oficial", runbook.includes("DIAN") && runbook.includes("VERI*FACTU") && runbook.includes("Utah Sales & Use Tax"), "fiscal");
}

const backupRunbookPath = join(root, "docs/runbooks/backup-restore.md");
if (existsSync(backupRunbookPath)) {
  const runbook = readFileSync(backupRunbookPath, "utf8");
  check("Runbook cubre backup DB", runbook.includes("npm run db:backup") && runbook.includes("checksum SHA-256"), "backup db");
  check("Runbook cubre restore verificado", runbook.includes("npm run db:restore -- --verify-only") && runbook.includes("RESTORE_CONFIRM"), "restore");
  check("Runbook cubre storage backup", runbook.includes("Supabase Storage") && runbook.includes("storage_checksum_sha256"), "storage backup");
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Operations audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Operations audit passed with ${checks.length} checks.`);
