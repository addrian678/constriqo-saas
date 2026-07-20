import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

const requiredFiles = [
  "server/src/licensing/licenseContracts.ts",
  "server/src/licensing/licensePolicy.ts",
  "server/src/security/secretsPolicy.ts",
  "server/src/security/hardeningPolicy.ts",
  "database/migrations/0019_commercial_security_functional.sql",
  "docs/runbooks/secrets-management.md",
  "docs/runbooks/commercial-license.md",
  "docs/legal/LICENSE_POLICY_DRAFT.md",
];

for (const file of requiredFiles) {
  check(`Archivo requerido ${file}`, existsSync(join(root, file)), file);
}

const packagePath = join(root, "package.json");
if (existsSync(packagePath)) {
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  check("Package script audit:commercial-security", Boolean(pkg.scripts?.["audit:commercial-security"]), "audit:commercial-security");
  check("Verify incluye commercial security", String(pkg.scripts?.verify).includes("audit:commercial-security"), "verify");
}

const licensePolicyPath = join(root, "server/src/licensing/licensePolicy.ts");
if (existsSync(licensePolicyPath)) {
  const policy = readFileSync(licensePolicyPath, "utf8");
  check("Licencia prefiere SaaS administrado", policy.includes("provider-managed-saas"), "managed SaaS");
  check("Licencia prohibe repo sin contrato", policy.includes("prohibited-without-explicit-contract"), "source delivery");
  check("Licencia preparada para fail closed", policy.includes("failClosedInProduction: true"), "fail closed");
  check("Licencia exige auditoria futura", policy.includes("licenseChanges"), "licenseChanges");
}

const secretsPolicyPath = join(root, "server/src/security/secretsPolicy.ts");
if (existsSync(secretsPolicyPath)) {
  const policy = readFileSync(secretsPolicyPath, "utf8");
  check("Secretos solo entorno", policy.includes("environmentOnly: true"), "environmentOnly");
  check("Secretos prohibidos en frontend", policy.includes("frontendSecretsAllowed: false"), "frontendSecretsAllowed");
  check("Secretos prohibidos en commits", policy.includes("commitSecretsAllowed: false"), "commitSecretsAllowed");
  check("Rotacion cada 90 dias", policy.includes("scheduledDays: 90"), "rotation");
  check("Logs redactan tokens", policy.includes("redactTokens: true"), "redactTokens");
}

const hardeningPolicyPath = join(root, "server/src/security/hardeningPolicy.ts");
if (existsSync(hardeningPolicyPath)) {
  const policy = readFileSync(hardeningPolicyPath, "utf8");
  check("Hardening exige HTTPS prod", policy.includes("httpsRequiredInProduction: true"), "https");
  check("Hardening exige MFA admin", policy.includes("adminMfaRequiredBeforeProduction: true"), "mfa");
  check("Hardening exige rate limit formularios", policy.includes("rateLimitRequiredForPublicForms: true"), "rate limit");
  check("Hardening exige audit dependencias", policy.includes("dependencyAuditRequired: true"), "dependency audit");
}

const migrationPath = join(root, "database/migrations/0019_commercial_security_functional.sql");
if (existsSync(migrationPath)) {
  const migration = readFileSync(migrationPath, "utf8");
  for (const table of ["installation_licenses", "secret_rotation_events", "deployment_access_events"]) {
    check(`Tabla seguridad comercial ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Licencia guarda hash no secreto", migration.includes("license_fingerprint_hash text NOT NULL"), "fingerprint hash");
  check("Licencia tiene allowed_modules jsonb", migration.includes("allowed_modules jsonb"), "allowed_modules");
  check("Rotacion registra scope", migration.includes("secret_scope text NOT NULL"), "secret_scope");
}

const secretsRunbookPath = join(root, "docs/runbooks/secrets-management.md");
if (existsSync(secretsRunbookPath)) {
  const runbook = readFileSync(secretsRunbookPath, "utf8");
  check("Runbook prohibe secretos en frontend", runbook.includes("Nunca en frontend"), "frontend");
  check("Runbook prohibe secretos en git", runbook.includes("Nunca en git"), "git");
  check("Runbook exige secretos por cliente", runbook.includes("Secretos diferentes por cliente"), "per customer");
}

const licenseRunbookPath = join(root, "docs/runbooks/commercial-license.md");
if (existsSync(licenseRunbookPath)) {
  const runbook = readFileSync(licenseRunbookPath, "utf8");
  check("Runbook afirma no entregar repo", runbook.includes("no entregar el repositorio fuente"), "repo");
  check("Runbook menciona registry privado", runbook.includes("registry controlado"), "registry");
  check("Runbook reconoce limites tecnicos", runbook.includes("Ningun sistema impide al 100%"), "limits");
}

const legalDraftPath = join(root, "docs/legal/LICENSE_POLICY_DRAFT.md");
if (existsSync(legalDraftPath)) {
  const legal = readFileSync(legalDraftPath, "utf8");
  check("Borrador prohibe redistribucion", legal.includes("No redistribuir el software"), "redistribution");
  check("Borrador conserva codigo fuente proveedor", legal.includes("codigo fuente permanece propiedad del proveedor"), "source ownership");
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Commercial security audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Commercial security audit passed with ${checks.length} checks.`);
