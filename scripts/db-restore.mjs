import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const verifyOnly = args.has("--verify-only");
const backupFile = process.env.BACKUP_FILE || process.argv.find((arg) => arg.endsWith(".dump"));
const restoreDatabaseUrl = process.env.RESTORE_DATABASE_URL;
const confirm = process.env.RESTORE_CONFIRM;
const REQUIRED_CONFIRM = "I_UNDERSTAND_RESTORE_OVERWRITES_DATABASE";

if (!backupFile) {
  console.error("BACKUP_FILE or a .dump path argument is required.");
  process.exit(1);
}

const backupPath = resolve(backupFile);
if (!existsSync(backupPath)) {
  console.error(`Backup file not found: ${backupPath}`);
  process.exit(1);
}

const checksumSha256 = createHash("sha256").update(readFileSync(backupPath)).digest("hex");
console.log(`Backup file: ${backupPath}`);
console.log(`Backup checksum sha256: ${checksumSha256}`);

const listResult = spawnSync("pg_restore", ["--list", backupPath], {
  encoding: "utf8",
  stdio: "pipe",
});

if (listResult.status !== 0) {
  console.error("Backup verification failed. Check pg_restore availability and backup integrity.");
  console.error(listResult.stderr || listResult.stdout);
  process.exit(listResult.status || 1);
}

const objectCount = listResult.stdout.split(/\r?\n/u).filter((line) => line.trim() && !line.trim().startsWith(";")).length;
console.log(`Backup verification ok. Objects listed: ${objectCount}`);

if (verifyOnly) {
  console.log("Restore verify-only completed. No database was modified.");
  process.exit(0);
}

if (!restoreDatabaseUrl) {
  console.error("RESTORE_DATABASE_URL is required for restore.");
  process.exit(1);
}

if (confirm !== REQUIRED_CONFIRM) {
  console.error(`RESTORE_CONFIRM must be exactly ${REQUIRED_CONFIRM}. Restore aborted.`);
  process.exit(1);
}

if (/localhost|127\.0\.0\.1/iu.test(restoreDatabaseUrl) && process.env.ALLOW_LOCAL_RESTORE !== "true") {
  console.error("Local restore requires ALLOW_LOCAL_RESTORE=true to avoid accidental overwrite.");
  process.exit(1);
}

const restoreResult = spawnSync(
  "pg_restore",
  [
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    "--dbname",
    restoreDatabaseUrl,
    backupPath,
  ],
  {
    encoding: "utf8",
    stdio: "pipe",
  },
);

if (restoreResult.status !== 0) {
  console.error("Database restore failed. Review the target database and backup file.");
  console.error(restoreResult.stderr || restoreResult.stdout);
  process.exit(restoreResult.status || 1);
}

console.log("Database restore completed.");
