import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

const requiredFiles = [
  "release/artifact-policy.json",
  "docs/runbooks/customer-deployment.md",
  "scripts/prepare-release-artifact.mjs",
];

for (const file of requiredFiles) {
  check(`Archivo requerido ${file}`, existsSync(join(root, file)), file);
}

const packagePath = join(root, "package.json");
if (existsSync(packagePath)) {
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  check("Package permanece privado", pkg.private === true, "private true");
  check("Package script release:artifact", Boolean(pkg.scripts?.["release:artifact"]), "release:artifact");
  check("Package script audit:distribution", Boolean(pkg.scripts?.["audit:distribution"]), "audit:distribution");
}

const manifestPath = join(root, "release/manifest.json");
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  check("Manifest declara artifact command", manifest.commands?.artifact === "npm run release:artifact", "artifact command");
}

const policyPath = join(root, "release/artifact-policy.json");
if (existsSync(policyPath)) {
  const policy = JSON.parse(readFileSync(policyPath, "utf8"));
  check("Politica recomienda SaaS administrado", policy.recommendedDelivery === "provider-managed-saas", policy.recommendedDelivery);
  check("Politica prohibe entregar repo", policy.clientMustNotReceiveRepository === true, "clientMustNotReceiveRepository");
  check("Politica excluye .env", policy.excludeAlways.includes(".env"), ".env");
  check("Politica excluye .git", policy.excludeAlways.includes(".git"), ".git");
  check("Politica excluye datos locales", policy.excludeAlways.includes(".local-data"), ".local-data");
  check("Politica excluye backups", policy.excludeAlways.includes("backups"), "backups");
  check("Politica excluye fuente frontend", policy.excludeAlways.includes("src"), "src");
  check("Politica excluye fuente backend", policy.excludeAlways.includes("server/src"), "server/src");
  check("Politica no permite secretos frontend", policy.secretRules?.frontendSecretsAllowed === false, "frontend secrets");
  check("Politica no permite DATABASE_URL", policy.secretRules?.databaseUrlAllowedInArtifact === false, "DATABASE_URL");
}

const artifactScriptPath = join(root, "scripts/prepare-release-artifact.mjs");
if (existsSync(artifactScriptPath)) {
  const script = readFileSync(artifactScriptPath, "utf8");
  check("Artifact valida no entregar repo", script.includes("clientMustNotReceiveRepository"), "clientMustNotReceiveRepository");
  check("Artifact usa tmp/release-artifacts", script.includes('"tmp", "release-artifacts"'), "tmp/release-artifacts");
  check("Artifact genera manifest", script.includes("artifact-manifest.json"), "artifact manifest");
}

const deploymentPath = join(root, "docs/runbooks/customer-deployment.md");
if (existsSync(deploymentPath)) {
  const guide = readFileSync(deploymentPath, "utf8");
  check("Guia exige tenant propio", guide.includes("Tenant propio"), "Tenant propio");
  check("Guia describe SaaS multi-tenant", guide.includes("SaaS multi-tenant gestionado"), "SaaS");
  check("Guia prohibe repo como recomendacion", guide.includes("No recomendado"), "repo not recommended");
  check("Guia prohibe tenant_id desde frontend", guide.includes("No aceptar `tenant_id` desde frontend"), "tenant_id frontend");
  check("Guia exige filtro por tenant", guide.includes("Toda consulta de negocio debe filtrar por tenant"), "tenant filter");
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Distribution audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Distribution audit passed with ${checks.length} checks.`);
