import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

const requiredFiles = [
  "src/shared/components/RoleDemoSwitcher.tsx",
  "src/app/App.tsx",
  "src/app/config/appConfig.ts",
  "docs/product-delivery-update-security-plan.md",
  "server/src/auth/sessionContext.ts",
  "server/runtime/postgresAuthRepository.mjs",
  "server/runtime/cryptoAuth.mjs",
  "scripts/auth-local-smoke.mjs",
  "server/src/core/requestContext.ts",
];

for (const file of requiredFiles) {
  check(`Archivo requerido ${file}`, existsSync(join(root, file)), file);
}

const packagePath = join(root, "package.json");
if (existsSync(packagePath)) {
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  check("Package script audit:auth-entry", Boolean(pkg.scripts?.["audit:auth-entry"]), "audit:auth-entry");
  check("Package script smoke:auth-local", Boolean(pkg.scripts?.["smoke:auth-local"]), "smoke:auth-local");
  check("Package script reset MFA seguro", Boolean(pkg.scripts?.["auth:reset-mfa"]), "auth:reset-mfa");
  check("Verify incluye audit:auth-entry", String(pkg.scripts?.verify).includes("audit:auth-entry"), "verify");
}

const configPath = join(root, "src/app/config/appConfig.ts");
if (existsSync(configPath)) {
  const config = readFileSync(configPath, "utf8");
  check("Demo mode deshabilitado", config.includes("enabled: false"), "demo disabled");
  check("Demo seed deshabilitado", config.includes('seedData: "disabled"'), "disabled");
}

const appPath = join(root, "src/app/App.tsx");
if (existsSync(appPath)) {
  const app = readFileSync(appPath, "utf8");
  check("App usa login real de cliente", app.includes('entry="tenant"'), "tenant login");
  check("App separa Super Admin", app.includes('"/acceso-admi-proveedor-constriqo"') && app.includes('entry="super-admin"'), "provider route");
  check("App no abre Super Admin por subdominio duplicado", !app.includes("admin.constriqo.com") && !app.includes("isProviderHost"), "single provider route");
  check("Ruta Super Admin antigua no abre consola", app.includes('"/super-admin"') && app.includes("Pagina no encontrada"), "legacy provider route blocked");
  check("App no carga demo desarrollo", !app.includes("DevelopmentDemoApp") && !app.includes("import.meta.env.DEV"), "no dev demo");
  check("App no importa rutas visuales directamente", !app.includes('from "./routes/AppRoutes"'), "no AppRoutes static import");
}

const loginPath = join(root, "src/shared/components/RoleDemoSwitcher.tsx");
if (existsSync(loginPath)) {
  const login = readFileSync(loginPath, "utf8");
  check("Login muestra iniciar sesion", login.includes("Iniciar sesion"), "Iniciar sesion");
  check("Login no ofrece crear cuenta", !login.toLowerCase().includes("crear cuenta"), "crear cuenta");
  check("Login usa email", login.includes('type="email"'), "email");
  check("Login usa password", login.includes('type="password"'), "password");
  check("Admin 2FA despues de credenciales", login.includes("despues de validar la contrasena"), "2FA after password");
  check("Login productivo no importa mock data", !login.includes("../../mock-data/company"), "no mock import");
  check("Login productivo no contiene demo panel", !login.includes("Demo desarrollo"), "no demo panel");
}

check("Archivo demo desarrollo eliminado", !existsSync(join(root, "src/app/DevelopmentDemoApp.tsx")), "no DevelopmentDemoApp");

const planPath = join(root, "docs/product-delivery-update-security-plan.md");
if (existsSync(planPath)) {
  const plan = readFileSync(planPath, "utf8");
  check("Plan declara demo solo development", plan.includes("Solo puede estar activo en entorno `development`"), "development");
  check("Plan prohibe registro publico", plan.includes("Sin registro publico"), "Sin registro publico");
  check("Plan exige admin 2FA", plan.includes("Si el usuario es administrador, se exige 2FA"), "admin 2FA");
  check("Plan no revela admin por email", plan.includes("no debe revelar si un email pertenece a un administrador"), "email enumeration");
}

const requestContextPath = join(root, "server/src/core/requestContext.ts");
if (existsSync(requestContextPath)) {
  const context = readFileSync(requestContextPath, "utf8");
  check("Request context se crea desde usuario autenticado", context.includes("createRequestContextFromAuthenticatedUser"), "authenticated context");
  check("Request context ya no usa tenant demo fijo", !context.includes("tenant-demo-canyon"), "no fixed tenant");
}

const sessionContextPath = join(root, "server/src/auth/sessionContext.ts");
if (existsSync(sessionContextPath)) {
  const sessionContext = readFileSync(sessionContextPath, "utf8");
  check("Session resolver exige Bearer token", sessionContext.includes("Authorization bearer token is required"), "bearer required");
  check("Session resolver busca token hash", sessionContext.includes("findSessionByTokenHash"), "session token hash");
  check("Session resolver expira sesiones vencidas", sessionContext.includes("expiresAt") && sessionContext.includes("Date.now()"), "expiresAt");
}

const runtimeAuthRepositoryPath = join(root, "server/runtime/postgresAuthRepository.mjs");
if (existsSync(runtimeAuthRepositoryPath)) {
  const repository = readFileSync(runtimeAuthRepositoryPath, "utf8");
  check("Runtime auth login valida password real", repository.includes("verifyPassword(password, identity.passwordHash)"), "verifyPassword");
  check("Runtime auth crea session token hash-only", repository.includes("hashSessionToken(sessionToken)") && repository.includes("session_token_hash"), "hashSessionToken");
  check("Runtime auth bloquea accesos privilegiados sin MFA", repository.includes("privilegedAccessRequiresMfa") && repository.includes('"super_admin"') && repository.includes("MFA_SETUP_REQUIRED"), "admin/super admin MFA");
  check("Runtime auth bloquea licencias invalidas", repository.includes("ensureTenantLicenseAllowsAccess") && repository.includes("LICENSE_SUSPENDED") && repository.includes("LICENSE_EXPIRED"), "license gate");
  check("Runtime auth valida licencia en sesiones", repository.includes("resolveSession") && repository.includes("await ensureTenantLicenseAllowsAccess(resolved.user)"), "session license gate");
  check("Runtime auth devuelve setup MFA temporal", repository.includes("mfaSetupToken") && repository.includes("setup_totp"), "setup token");
  check("Runtime auth verifica TOTP antes de sesion admin", repository.includes("verifyTotp") && repository.includes("verifyTotpCode"), "verifyTotp");
  check("Runtime auth no filtra fallo crudo de descifrado MFA", repository.includes("MFA_SECRET_UNREADABLE") && repository.includes("Restablece MFA"), "MFA_SECRET_UNREADABLE");
  check("Runtime auth activa tenant context", repository.includes("set_config('app.tenant_id'"), "app.tenant_id");
  check("Runtime auth usa tokens con tenant", repository.includes("createScopedToken") && repository.includes("extractTenantIdFromScopedToken"), "tenant token");
  check("Runtime auth revoca sesiones", repository.includes("UPDATE auth_sessions") && repository.includes("revoked_at = now()"), "logout revoke");
}

const resetMfaPath = join(root, "scripts/reset-user-mfa.mjs");
if (existsSync(resetMfaPath)) {
  const resetMfa = readFileSync(resetMfaPath, "utf8");
  check("Reset MFA exige confirmacion explicita", resetMfa.includes("I_UNDERSTAND_THIS_RESETS_USER_MFA"), "confirm");
  check("Reset MFA exige tenant y email", resetMfa.includes("RESET_MFA_TENANT_ID") && resetMfa.includes("RESET_MFA_EMAIL"), "tenant/email");
  check("Reset MFA revoca sesiones activas", resetMfa.includes("UPDATE auth_sessions") && resetMfa.includes("revoked_at = now()"), "sessions");
  check("Reset MFA registra auditoria", resetMfa.includes("auth.mfa.reset") && resetMfa.includes("audit_events"), "audit");
}

const runtimeCryptoPath = join(root, "server/runtime/cryptoAuth.mjs");
if (existsSync(runtimeCryptoPath)) {
  const cryptoAuth = readFileSync(runtimeCryptoPath, "utf8");
  check("Runtime crypto usa Argon2", cryptoAuth.includes("argon2.verify"), "argon2.verify");
  check("Runtime crypto hashea tokens con sha256", cryptoAuth.includes('createHash("sha256")'), "sha256");
  check("Runtime crypto genera token aleatorio", cryptoAuth.includes("randomBytes"), "randomBytes");
  check("Runtime crypto implementa TOTP", cryptoAuth.includes("createHmac(\"sha1\"") && cryptoAuth.includes("verifyTotpCode"), "TOTP");
  check("Runtime crypto cifra secreto MFA", cryptoAuth.includes("aes-256-gcm") && cryptoAuth.includes("decryptSecret"), "MFA encryption");
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Auth entry audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Auth entry audit passed with ${checks.length} checks.`);
