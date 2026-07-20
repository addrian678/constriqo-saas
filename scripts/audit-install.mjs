import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

const requiredFiles = [
  "database/seeds/install_seed_template.sql",
  "scripts/create-install-seed.mjs",
  "scripts/install-initial-admin.mjs",
  "scripts/auth-local-smoke.mjs",
  "scripts/db-create-runtime-role.mjs",
];

for (const file of requiredFiles) {
  check(`Archivo requerido ${file}`, existsSync(join(root, file)), file);
}

const templatePath = join(root, "database/seeds/install_seed_template.sql");
if (existsSync(templatePath)) {
  const template = readFileSync(templatePath, "utf8");
  check("Template usa placeholders", template.includes("{{TENANT_ID}}") && template.includes("{{ADMIN_EMAIL}}"), "placeholders");
  check("Admin inicial queda invited", template.includes("'invited'"), "invited");
  check("Template no contiene password", !template.toLowerCase().includes("password_hash"), "password_hash");
}

const scriptPath = join(root, "scripts/create-install-seed.mjs");
if (existsSync(scriptPath)) {
  const script = readFileSync(scriptPath, "utf8");
  check("Script requiere company", script.includes("--company"), "--company");
  check("Script requiere admin-email", script.includes("--admin-email"), "--admin-email");
  check("Script genera UUID", script.includes("randomUUID"), "randomUUID");
}

const installAdminPath = join(root, "scripts/install-initial-admin.mjs");
if (existsSync(installAdminPath)) {
  const script = readFileSync(installAdminPath, "utf8");
  check("Install admin requiere DATABASE_URL", script.includes("DATABASE_URL is required"), "DATABASE_URL");
  check("Install admin usa Argon2id", script.includes("argon2.hash") && script.includes("argon2id"), "argon2id");
  check("Install admin no guarda password plano", script.includes("passwordStored") && script.includes("argon2id-hash-only"), "hash-only");
  check("Install admin asigna rol admin", script.includes("user_roles") && script.includes("code = 'admin'"), "admin role");
  check("Install admin activa tenant context", script.includes("set_config('app.tenant_id'"), "app.tenant_id");
}

const authSmokePath = join(root, "scripts/auth-local-smoke.mjs");
if (existsSync(authSmokePath)) {
  const script = readFileSync(authSmokePath, "utf8");
  check("Auth smoke exige tenant real", script.includes("TEST_TENANT_ID") && script.includes("TEST_ADMIN_EMAIL"), "tenant smoke");
  check("Auth smoke prueba MFA setup", script.includes("/api/auth/mfa/totp/setup"), "mfa setup");
  check("Auth smoke prueba MFA verify", script.includes("/api/auth/mfa/totp/verify"), "mfa verify");
  check("Auth smoke rechaza tenant spoofing", script.includes("tenant_id=00000000-0000-0000-0000-000000000000"), "tenant spoofing");
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Install audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Install audit passed with ${checks.length} checks.`);
