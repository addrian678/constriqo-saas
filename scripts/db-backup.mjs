import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const databaseUrl = process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL;
const backupsDir = join(root, "backups", "db");

if (!databaseUrl) {
  console.error("BACKUP_DATABASE_URL or DATABASE_URL is required. Backup aborted.");
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = join(backupsDir, `constructflow-${timestamp}.dump`);

mkdirSync(backupsDir, { recursive: true });

const result = spawnSync("pg_dump", [databaseUrl, "--format=custom", "--file", outputPath], {
  encoding: "utf8",
  stdio: "pipe",
});

if (result.status !== 0) {
  console.error("Database backup failed. Check pg_dump availability and database access.");
  console.error(result.stderr || result.stdout);
  process.exit(result.status || 1);
}

const buffer = readFileSync(outputPath);
const checksumSha256 = createHash("sha256").update(buffer).digest("hex");
const metadataPath = `${outputPath}.json`;
writeFileSync(
  metadataPath,
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      file: outputPath,
      sizeBytes: statSync(outputPath).size,
      checksumSha256,
      format: "pg_dump custom",
      source: "ConstructFlow db:backup",
      databaseUrlRedacted: redactDatabaseUrl(databaseUrl),
    },
    null,
    2,
  ),
);

console.log(`Database backup created: ${outputPath}`);
console.log(`Backup metadata created: ${metadataPath}`);
console.log(`Backup checksum sha256: ${checksumSha256}`);

function redactDatabaseUrl(value) {
  return String(value || "").replace(/:\/\/([^:]+):([^@]+)@/u, "://$1:***@");
}
