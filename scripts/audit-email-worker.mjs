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

const migration = readProjectFile("database/migrations/0051_email_delivery_worker_outbox.sql");
const worker = readProjectFile("server/runtime/emailWorker.mjs");
const notificationsRepo = readProjectFile("server/runtime/postgresNotificationsRepository.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const runbook = readProjectFile("docs/runbooks/domain-supabase-email-storage.md");
const envExample = readProjectFile(".env.example");
const smoke = readProjectFile("scripts/email-worker-local-smoke.mjs");
const packageJson = JSON.parse(readProjectFile("package.json"));

check("Migration agrega campos de worker", migration.includes("attempt_count") && migration.includes("next_attempt_at") && migration.includes("provider_message_id"), "worker columns");
check("Migration evita doble procesamiento", migration.includes("worker_locked_until") && migration.includes("idx_email_deliveries_worker_queue"), "worker lock");
check("Worker toma cola con bloqueo seguro", worker.includes("FOR UPDATE SKIP LOCKED") && worker.includes("worker_locked_until"), "queue lock");
check("Worker procesa sandbox y SMTP", worker.includes('provider === "sandbox"') && worker.includes("sendSmtpEmail") && worker.includes("AUTH PLAIN"), "providers");
check("Worker implementa reintentos", worker.includes("retryDelaySeconds") && worker.includes("EMAIL_WORKER_MAX_ATTEMPTS") && worker.includes("email.delivery.retry_scheduled"), "retry");
check("Worker escribe auditoria tenant", worker.includes("INSERT INTO audit_events") && worker.includes("SELECT set_config('app.tenant_id'"), "audit");
check("Historial expone intentos", notificationsRepo.includes("attempt_count") && notificationsRepo.includes("provider_message_id"), "notifications history");
check("Readiness exige migracion productiva vigente", server.includes("0055_supabase_readiness_schema_migrations_rls.sql") && server.includes("EMAIL_DELIVERY_WORKER_ENABLED"), "readiness");
check("Env documenta worker", envExample.includes("EMAIL_WORKER_DATABASE_URL") && envExample.includes("EMAIL_WORKER_MAX_ATTEMPTS") && envExample.includes("SMTP_SECURE"), ".env.example");
check("Runbook documenta worker", runbook.includes("npm run email:worker") && runbook.includes("EMAIL_WORKER_DATABASE_URL"), "runbook");
check("Smoke local valida worker", smoke.includes("processEmailDeliveryBatch") && smoke.includes("email delivery sandboxed by worker"), "smoke");
check("Package registra comandos worker", Boolean(packageJson.scripts?.["email:worker"]) && Boolean(packageJson.scripts?.["email:worker:once"]), "package worker scripts");
check("Package registra auditoria worker", Boolean(packageJson.scripts?.["audit:email-worker"]) && packageJson.scripts?.verify.includes("audit:email-worker"), "verify");
check("Package registra smoke worker", Boolean(packageJson.scripts?.["smoke:email-worker-local"]), "smoke script");

if (failures > 0) {
  console.error(`Email worker audit failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log("Email worker audit passed.");
