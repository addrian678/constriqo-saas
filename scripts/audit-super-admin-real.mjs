import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
let failures = 0;

function readProjectFile(relativePath) {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`ok - ${name}`);
    return;
  }
  failures += 1;
  console.error(`not ok - ${name}${detail ? ` (${detail})` : ""}`);
}

const migration = readProjectFile("database/migrations/0045_super_admin_licensing.sql");
const tenantAdminCleanupMigration = readProjectFile("database/migrations/0058_remove_superadmin_from_tenant_admin.sql");
const repository = readProjectFile("server/runtime/postgresSuperAdminRepository.mjs");
const routes = readProjectFile("server/runtime/runtimeRoutes.mjs");
const manifest = readProjectFile("server/runtime/runtimeManifest.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const authRepository = readProjectFile("server/runtime/postgresAuthRepository.mjs");
const appEntry = readProjectFile("src/app/App.tsx");
const app = readProjectFile("src/app/ProductionApp.tsx");
const page = readProjectFile("src/modules/super-admin/pages/SuperAdminWorkspace.tsx");
const client = readProjectFile("src/modules/super-admin/api/superAdminClient.ts");
const install = readProjectFile("scripts/install-super-admin.mjs");
const initialAdminInstall = readProjectFile("scripts/install-initial-admin.mjs");
const smoke = readProjectFile("scripts/super-admin-local-smoke.mjs");
const packageJson = JSON.parse(readProjectFile("package.json"));

check("Migration crea tenant proveedor", migration.includes("ConstructFlow Provider") && migration.includes("00000000-0000-4000-8000-000000000001"), "provider tenant");
check("Migration crea licencias", migration.includes("CREATE TABLE IF NOT EXISTS tenant_licenses") && migration.includes("trial_7d") && migration.includes("two_years"), "tenant_licenses");
check("Migration crea auditoria global", migration.includes("CREATE TABLE IF NOT EXISTS super_admin_audit_events"), "super admin audit");
check("Migration registra capacidades Super Admin", migration.includes("superadmin.read") && migration.includes("superadmin.manage"), "capabilities");
check("Repository usa conexion administrativa separada", repository.includes("SUPER_ADMIN_DATABASE_URL") && repository.includes("ADMIN_DATABASE_URL"), "admin connection");
check("Repository exige rol y capability", repository.includes('roles.includes("super_admin")') && repository.includes("capabilities.includes(capability)"), "role guard");
check("Repository no da superadmin a admin tenant", repository.includes("c.code NOT LIKE 'superadmin.%'"), "tenant admin capabilities");
check("Instalador cliente no da superadmin a admin tenant", initialAdminInstall.includes("c.code NOT LIKE 'superadmin.%'"), "initial admin capabilities");
check("Migracion limpia superadmin de roles tenant", tenantAdminCleanupMigration.includes("c.code LIKE 'superadmin.%'") && tenantAdminCleanupMigration.includes("r.scope = 'tenant'"), "tenant cleanup");
check("Repository soporta presets de licencia", repository.includes("trial_7d") && repository.includes("trial_30d") && repository.includes("one_year") && repository.includes("two_years"), "duration presets");
check("Repository crea clientes con admin inicial", repository.includes("createTenant") && repository.includes("temporaryPassword") && repository.includes("tenant.initial_admin_created"), "tenant create");
check("Repository resume alertas proveedor", repository.includes("expiringSoon") && repository.includes("storageOverQuota") && repository.includes("blocked"), "summary alerts");
check("Rutas API Super Admin declaradas", routes.includes('method: "POST", path: "/api/super-admin/tenants"') && routes.includes("/api/super-admin/tenants/:tenantId/license"), "routes");
check("Manifest publica modulo Super Admin", manifest.includes('"super-admin"') && manifest.includes("/api/super-admin/tenants"), "manifest");
check("Runtime conecta handler Super Admin", server.includes("handleSuperAdminRoute") && server.includes('route.moduleId === "super-admin"'), "handler");
check("Auth exige MFA a super_admin", authRepository.includes('"super_admin"') && authRepository.includes("privilegedAccessRequiresMfa"), "mfa");
check("App separa ruta /super-admin", appEntry.includes('pathname.startsWith("/super-admin")') && appEntry.includes('entry="super-admin"'), "route split");
check("ProductionApp separa workspace proveedor", app.includes("SuperAdminWorkspace") && app.includes('roles.includes("super_admin")'), "workspace split");
check("Login normal bloquea Super Admin", app.includes('entry === "tenant"') && app.includes("Usa /super-admin"), "tenant login guard");
check("Login Super Admin bloquea usuarios cliente", app.includes('entry === "super-admin"') && app.includes("inicio de sesion normal para empresas"), "provider login guard");
check("Cliente frontend usa API Super Admin", client.includes("listSuperAdminTenants") && client.includes("updateTenantLicense") && client.includes("createTenantFromSuperAdmin"), "client");
check("Panel permite duraciones flexibles", page.includes("Prueba 7 dias") && page.includes("Prueba 30 dias") && page.includes("2 años"), "license options");
check("Panel crea cliente desde Super Admin", page.includes("Crear cliente y admin") && page.includes("Credenciales temporales"), "tenant create ui");
check("Panel muestra alertas y acciones rapidas", page.includes("Requieren revision") && page.includes("Extender 1 año") && page.includes("Suspender"), "alerts actions");
check("Instalador crea Super Admin con Argon2id", install.includes("argon2.hash") && install.includes("super_admin") && install.includes("mfaRequired"), "install");
check("Smoke valida acceso y licencia", smoke.includes("non-super cannot list tenants") && smoke.includes("two_years") && smoke.includes("LICENSE_SUSPENDED"), "smoke");
check("Package registra auditoria", Boolean(packageJson.scripts?.["audit:super-admin-real"]), "audit script");
check("Package registra smoke", Boolean(packageJson.scripts?.["smoke:super-admin-local"]), "smoke script");
check("Package registra instalador", Boolean(packageJson.scripts?.["install:super-admin"]), "install script");

if (failures > 0) {
  console.error(`Super Admin audit failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log("Super Admin audit passed.");
