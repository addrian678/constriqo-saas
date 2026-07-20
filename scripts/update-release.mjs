import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const canary = args.has("--canary");
const allTenants = args.has("--all-tenants");
const tenantArg = process.argv.slice(2).find((arg) => arg.startsWith("--tenant="));
const manifestPath = join(root, "release", "manifest.json");
const packagePath = join(root, "package.json");

function run(command, commandArgs, label) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(`Update step failed: ${label}`);
    process.exit(result.status || 1);
  }
}

if (!existsSync(manifestPath)) {
  console.error("release/manifest.json is required.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));

if (manifest.version !== pkg.version) {
  console.error("Release manifest version must match package.json version.");
  process.exit(1);
}

console.log(`ConstructFlow update plan for version ${manifest.version}`);
console.log("- Review release notes");
console.log("- Select rollout scope: --canary, --tenant=<tenant_id>, or --all-tenants");
console.log("- Create database backup");
console.log("- Apply pending migrations");
console.log("- Run smoke tests for selected tenant scope");

if (!apply) {
  console.log("Plan only. Re-run with --apply to execute.");
  process.exit(0);
}

const selectedRolloutModes = [canary, allTenants, Boolean(tenantArg)].filter(Boolean).length;
if (selectedRolloutModes !== 1) {
  console.error("Exactly one rollout scope is required with --apply: --canary, --tenant=<tenant_id>, or --all-tenants.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required for --apply updates.");
  process.exit(1);
}

const rolloutScope = canary ? "canary" : allTenants ? "all-tenants" : tenantArg;
console.log(`Rollout scope: ${rolloutScope}`);

run("npm", ["run", "db:backup"], "database backup");
run("npm", ["run", "db:migrate"], "database migrations");
run("npm", ["run", "smoke:test"], "smoke tests");

console.log(`ConstructFlow ${manifest.version} update completed.`);
