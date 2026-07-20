import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

const requiredFiles = [
  "release/manifest.json",
  "release/RELEASE_NOTES.md",
  "docs/runbooks/update-and-rollback.md",
  "scripts/db-backup.mjs",
  "scripts/smoke-test.mjs",
  "scripts/update-release.mjs",
  "scripts/db-migrate.mjs",
  "scripts/db-create-runtime-role.mjs",
  "release/artifact-policy.json",
];

for (const file of requiredFiles) {
  check(`Archivo requerido ${file}`, existsSync(join(root, file)), file);
}

const manifestPath = join(root, "release/manifest.json");
const packagePath = join(root, "package.json");
if (existsSync(manifestPath) && existsSync(packagePath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  check("Manifest version coincide con package", manifest.version === pkg.version, `${manifest.version} != ${pkg.version}`);
  check("Manifest declara SaaS multi-tenant", manifest.deploymentModel === "multi-tenant-saas", manifest.deploymentModel);
  check("Manifest exige backup antes de migrar", manifest.database?.backupRequiredBeforeMigration === true, "backupRequiredBeforeMigration");
  check("Manifest declara migracion tenant integrity", manifest.database?.tenantScopedIntegrityMigration === "database/migrations/0020_tenant_integrity_hardening.sql", "tenantScopedIntegrityMigration");
  check("Manifest declara rollout progresivo SaaS", manifest.rollout?.strategy === "saas-progressive", "saas-progressive");
  check("Manifest exige smoke por tenant", manifest.rollout?.tenantSmokeTestRequired === true, "tenantSmokeTestRequired");
  check("Manifest declara schema_migrations", manifest.database?.migrationTable === "schema_migrations", "schema_migrations");
  check("Manifest declara runbook rollback", manifest.rollback?.runbook === "docs/runbooks/update-and-rollback.md", "rollback runbook");
}

const packageSource = existsSync(packagePath) ? readFileSync(packagePath, "utf8") : "";
for (const scriptName of ["db:backup", "smoke:test", "release:update", "audit:update"]) {
  check(`Package script ${scriptName}`, packageSource.includes(`"${scriptName}"`), scriptName);
}

const backupPath = join(root, "scripts/db-backup.mjs");
if (existsSync(backupPath)) {
  const backup = readFileSync(backupPath, "utf8");
  check("Backup requiere DATABASE_URL", backup.includes("DATABASE_URL is required"), "DATABASE_URL");
  check("Backup usa pg_dump", backup.includes("pg_dump"), "pg_dump");
  check("Backup escribe en backups/db", backup.includes('"backups", "db"'), "backups/db");
}

const migratePath = join(root, "scripts/db-migrate.mjs");
if (existsSync(migratePath)) {
  const migrate = readFileSync(migratePath, "utf8");
  check("Migrador registra checksum", migrate.includes("checksum_sha256") && migrate.includes("createHash"), "checksum");
  check("Migrador detecta dirty state", migrate.includes("dirty state") && migrate.includes("status !== \"applied\""), "dirty state");
  check("Migrador registra duracion", migrate.includes("duration_ms"), "duration_ms");
  check("Migrador no depende de psql", migrate.includes('from "pg"') && !migrate.includes("spawnSync"), "node pg");
  check("Migrador soporta URL de migracion separada", migrate.includes("MIGRATION_DATABASE_URL"), "MIGRATION_DATABASE_URL");
}

const artifactPolicyPath = join(root, "release/artifact-policy.json");
if (existsSync(artifactPolicyPath)) {
  const policy = JSON.parse(readFileSync(artifactPolicyPath, "utf8"));
  check("Artefacto incluye scripts operativos", policy.include?.includes("scripts"), "scripts");
  check("Artefacto excluye source app", policy.excludeAlways?.includes("src") && policy.excludeAlways?.includes("server/src"), "source excluded");
}

const updatePath = join(root, "scripts/update-release.mjs");
if (existsSync(updatePath)) {
  const update = readFileSync(updatePath, "utf8");
  check("Update tiene modo --apply", update.includes("--apply"), "--apply");
  check("Update exige scope de rollout", update.includes("--canary") && update.includes("--tenant=<tenant_id>") && update.includes("--all-tenants"), "rollout scope");
  check("Update evita scope ambiguo", update.includes("Exactly one rollout scope is required"), "one rollout scope");
  check("Update ejecuta backup antes de migrar", update.indexOf('"db:backup"') !== -1 && update.indexOf('"db:backup"') < update.indexOf('"db:migrate"'), "backup before migrate");
  check("Update ejecuta smoke tests", update.includes('"smoke:test"'), "smoke:test");
  check("Update valida version package/manifest", update.includes("manifest.version !== pkg.version"), "version match");
}

const runbookPath = join(root, "docs/runbooks/update-and-rollback.md");
if (existsSync(runbookPath)) {
  const runbook = readFileSync(runbookPath, "utf8");
  check("Runbook prohibe migrar sin backup", runbook.includes("No aplicar migraciones sin backup"), "backup rule");
  check("Runbook documenta rollback DB", runbook.includes("Restaurar backup de base de datos"), "rollback DB");
  check("Runbook protege secretos", runbook.includes("No imprimir `DATABASE_URL`"), "secrets");
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Update audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Update audit passed with ${checks.length} checks.`);
