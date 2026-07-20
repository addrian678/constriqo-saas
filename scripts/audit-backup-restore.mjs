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

const backup = readProjectFile("scripts/db-backup.mjs");
const restore = readProjectFile("scripts/db-restore.mjs");
const runbook = readProjectFile("docs/runbooks/backup-restore.md");
const updateRunbook = readProjectFile("docs/runbooks/update-and-rollback.md");
const plan = readProjectFile("docs/product-delivery-update-security-plan.md");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("Backup usa pg_dump custom", backup.includes("pg_dump") && backup.includes("--format=custom"), "pg_dump");
check("Backup genera metadata", backup.includes("checksumSha256") && backup.includes("metadataPath") && backup.includes("databaseUrlRedacted"), "metadata");
check("Restore verifica con pg_restore list", restore.includes("pg_restore") && restore.includes("--list") && restore.includes("--verify-only"), "verify");
check("Restore exige confirmacion destructiva", restore.includes("I_UNDERSTAND_RESTORE_OVERWRITES_DATABASE") && restore.includes("RESTORE_CONFIRM"), "confirm");
check("Restore exige RESTORE_DATABASE_URL", restore.includes("RESTORE_DATABASE_URL is required"), "target db");
check("Restore bloquea local accidental", restore.includes("ALLOW_LOCAL_RESTORE") && restore.includes("Local restore requires"), "local guard");
check("Runbook backup/restore existe", runbook.includes("npm run db:backup") && runbook.includes("npm run db:restore"), "runbook");
check("Runbook documenta verify-only", runbook.includes("--verify-only") && runbook.includes("RESTORE_CONFIRM"), "verify-only");
check("Update runbook referencia restore seguro", updateRunbook.includes("backup-restore.md") && updateRunbook.includes("db:restore"), "update runbook");
check("Plan documenta A6", plan.includes("Actualizacion A6") && plan.includes("backup/restore"), "plan");
check("Package registra db:restore", Boolean(packageJson.scripts?.["db:restore"]), "db:restore");
check("Package registra audit:backup-restore", Boolean(packageJson.scripts?.["audit:backup-restore"]) && String(packageJson.scripts?.verify).includes("audit:backup-restore"), "audit");

if (failures > 0) {
  console.error(`Backup/restore audit failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log("Backup/restore audit passed.");
