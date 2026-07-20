import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

for (const file of ["docker-compose.yml", "scripts/db-migrate.mjs", "scripts/db-create-runtime-role.mjs", ".env.example"]) {
  check(`Archivo requerido ${file}`, existsSync(join(root, file)), file);
}

const composePath = join(root, "docker-compose.yml");
if (existsSync(composePath)) {
  const compose = readFileSync(composePath, "utf8");
  check("Compose usa postgres", compose.includes("postgres:16-alpine"), "postgres:16-alpine");
  check("Compose usa volumen local ignorado", compose.includes("./.local-data/postgres"), ".local-data");
  check("Compose tiene healthcheck", compose.includes("pg_isready"), "healthcheck");
}

const migratePath = join(root, "scripts/db-migrate.mjs");
if (existsSync(migratePath)) {
  const migrate = readFileSync(migratePath, "utf8");
  check("Migracion acepta MIGRATION_DATABASE_URL", migrate.includes("MIGRATION_DATABASE_URL") && migrate.includes("DATABASE_URL"), "MIGRATION_DATABASE_URL");
  check("Migracion usa schema_migrations", migrate.includes("schema_migrations"), "schema_migrations");
  check("Migracion usa pg client", migrate.includes('from "pg"') && migrate.includes("new Client"), "pg Client");
  check("Migracion usa transacciones", migrate.includes('client.query("BEGIN")') && migrate.includes('client.query("COMMIT")'), "transaction");
  check("Migracion hace rollback", migrate.includes('client.query("ROLLBACK")'), "ROLLBACK");
}

const runtimeRolePath = join(root, "scripts/db-create-runtime-role.mjs");
if (existsSync(runtimeRolePath)) {
  const role = readFileSync(runtimeRolePath, "utf8");
  check("Runtime DB role no es superuser", role.includes("NOSUPERUSER") && role.includes("NOBYPASSRLS"), "NOBYPASSRLS");
  check("Runtime DB role recibe grants limitados", role.includes("GRANT SELECT, INSERT, UPDATE, DELETE") && role.includes("GRANT USAGE ON SCHEMA"), "grants");
  check("Runtime DB role exige password", role.includes("APP_DB_PASSWORD is required"), "APP_DB_PASSWORD");
}

const gitignorePath = join(root, ".gitignore");
if (existsSync(gitignorePath)) {
  const gitignore = readFileSync(gitignorePath, "utf8");
  check("Datos locales ignorados", gitignore.includes(".local-data/"), ".local-data/");
  check("Backups ignorados", gitignore.includes("backups/"), "backups/");
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Local DB audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Local DB audit passed with ${checks.length} checks.`);
