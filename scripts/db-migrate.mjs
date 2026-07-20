import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const { Client } = pg;
const root = process.cwd();
const migrationsDir = join(root, "database", "migrations");
const databaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("MIGRATION_DATABASE_URL or DATABASE_URL is required. Copy .env.example to .env or export DATABASE_URL.");
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : false,
});

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function checksumSql(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

async function queryScalar(sql, params = []) {
  const result = await client.query(sql, params);
  const firstRow = result.rows[0];
  if (!firstRow) {
    return "";
  }

  return String(Object.values(firstRow)[0] || "");
}

async function ensureSchemaMigrations() {
  await client.query(
    [
      "CREATE TABLE IF NOT EXISTS schema_migrations (",
      "version text PRIMARY KEY,",
      "checksum_sha256 text,",
      "status text NOT NULL DEFAULT 'applied',",
      "started_at timestamptz NOT NULL DEFAULT now(),",
      "completed_at timestamptz,",
      "applied_at timestamptz NOT NULL DEFAULT now(),",
      "duration_ms integer,",
      "operator text NOT NULL DEFAULT current_user,",
      "error_message text",
      ");",
      "ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum_sha256 text;",
      "ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'applied';",
      "ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now();",
      "ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS completed_at timestamptz;",
      "ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS duration_ms integer;",
      "ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS operator text NOT NULL DEFAULT current_user;",
      "ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS error_message text;",
    ].join(" "),
  );
}

async function applyMigration(file, sql, checksum) {
  const startedAt = Date.now();

  await client.query(
    `
      INSERT INTO schema_migrations(version, checksum_sha256, status, started_at, operator)
      VALUES ($1, $2, 'applying', now(), current_user)
    `,
    [file, checksum],
  );

  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    const durationMs = Date.now() - startedAt;
    const errorMessage = String(error.message || "Unknown migration error").slice(0, 2000);
    await client.query(
      `
        UPDATE schema_migrations
        SET status = 'failed', completed_at = now(), duration_ms = $2, error_message = $3
        WHERE version = $1
      `,
      [file, durationMs, errorMessage],
    );
    throw error;
  }

  const durationMs = Date.now() - startedAt;
  await client.query(
    `
      UPDATE schema_migrations
      SET status = 'applied', completed_at = now(), applied_at = now(), duration_ms = $2, error_message = NULL
      WHERE version = $1
    `,
    [file, durationMs],
  );
}

try {
  await client.connect();
  await ensureSchemaMigrations();

  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const checksum = checksumSql(sql);
    const migrationRecord = await queryScalar(
      "SELECT concat_ws(E'\\t', COALESCE(checksum_sha256, ''), status) AS record FROM schema_migrations WHERE version = $1",
      [file],
    );

    if (migrationRecord) {
      const [appliedChecksum, status] = migrationRecord.split("\t");
      if (status !== "applied") {
        console.error(`Migration ${file} is in dirty state: ${status}. Review schema_migrations before continuing.`);
        process.exit(1);
      }

      if (appliedChecksum && appliedChecksum !== checksum) {
        console.error(`Migration checksum mismatch for ${file}. Applied file differs from current file.`);
        process.exit(1);
      }

      console.log(`Skipping applied migration ${file}`);
      continue;
    }

    await applyMigration(file, sql, checksum);
    console.log(`Applied migration ${file}`);
  }
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
