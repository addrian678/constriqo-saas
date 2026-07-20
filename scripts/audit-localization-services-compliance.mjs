import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

function readProjectFile(path) {
  const fullPath = join(root, path);
  check(`Archivo requerido ${path}`, existsSync(fullPath), path);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

const migration = readProjectFile("database/migrations/0023_localization_services_compliance.sql");
const privacyMigration = readProjectFile("database/migrations/0041_privacy_preferences.sql");
const usageMigration = readProjectFile("database/migrations/0042_tenant_usage_quotas.sql");
const fiscalMigration = readProjectFile("database/migrations/0050_fiscal_profiles_provider_readiness.sql");
const orgRepo = readProjectFile("server/runtime/postgresOrganizationRepository.mjs");
const serviceRepo = readProjectFile("server/runtime/postgresServiceCatalogRepository.mjs");
const estimateRepo = readProjectFile("server/runtime/postgresEstimateRepository.mjs");
const invoiceRepo = readProjectFile("server/runtime/postgresInvoiceRepository.mjs");
const fiscalProfiles = readProjectFile("server/runtime/fiscalProfiles.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const routes = readProjectFile("server/runtime/runtimeRoutes.mjs");
const manifest = readProjectFile("server/runtime/runtimeManifest.mjs");
const workspace = readProjectFile("src/app/ProductionWorkspace.tsx");
const apiClient = readProjectFile("src/modules/organization/api/organizationClient.ts");
const settingsPage = readProjectFile("src/modules/organization/pages/TenantSettingsRealPage.tsx");
const servicesPage = readProjectFile("src/modules/services/pages/ServiceCatalogRealPage.tsx");
const estimatesPage = readProjectFile("src/modules/estimates/pages/EstimatesRealPage.tsx");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("Migracion agrega pais/moneda/unidades al tenant", migration.includes("country_profile") && migration.includes("unit_system") && migration.includes("document_language"), "tenant settings");
check("Migracion crea catalogo de servicios", migration.includes("CREATE TABLE IF NOT EXISTS service_catalog_items"), "service_catalog_items");
check("Migracion crea aceptaciones de politicas", migration.includes("CREATE TABLE IF NOT EXISTS tenant_policy_acceptances"), "tenant_policy_acceptances");
check("Migracion habilita RLS en tablas nuevas", migration.includes("ENABLE ROW LEVEL SECURITY") && migration.includes("FORCE ROW LEVEL SECURITY"), "RLS");
check("Migracion blinda servicio en estimate_items", migration.includes("fk_estimate_items_tenant_service_catalog"), "service FK");
check("Migracion crea preferencias privacidad", privacyMigration.includes("CREATE TABLE IF NOT EXISTS user_privacy_preferences"), "user_privacy_preferences");
check("Preferencias privacidad apagan no esenciales", privacyMigration.includes("analytics_cookies boolean NOT NULL DEFAULT false") && privacyMigration.includes("marketing_cookies boolean NOT NULL DEFAULT false"), "non-essential off");
check("Preferencias privacidad tienen RLS", privacyMigration.includes("ENABLE ROW LEVEL SECURITY") && privacyMigration.includes("user_privacy_preferences_tenant_isolation"), "privacy RLS");
check("Migracion crea cuotas por tenant", usageMigration.includes("CREATE TABLE IF NOT EXISTS tenant_usage_limits"), "tenant_usage_limits");
check("Cuotas registran add-ons comerciales", usageMigration.includes("photo_evidence_enabled") && usageMigration.includes("marketing_addon_enabled") && usageMigration.includes("dedicated_storage_enabled"), "addons");
check("Cuotas tienen RLS fuerte", usageMigration.includes("ALTER TABLE tenant_usage_limits ENABLE ROW LEVEL SECURITY") && usageMigration.includes("tenant_usage_limits_tenant_isolation"), "usage RLS");
check("Documentos tienen tamano de storage auditable", usageMigration.includes("storage_size_bytes") && usageMigration.includes("idx_documents_tenant_storage_size"), "storage size");
check("Migracion crea perfiles fiscales y proveedores", fiscalMigration.includes("tenant_fiscal_profiles") && fiscalMigration.includes("tenant_provider_settings"), "fiscal/provider migration");
check("Perfiles fiscales cubren US CO ES", fiscalProfiles.includes("countryProfile: \"US\"") && fiscalProfiles.includes("countryProfile: \"CO\"") && fiscalProfiles.includes("countryProfile: \"ES\""), "fiscal profiles");

check("Organization repository usa tenant context", orgRepo.includes("set_config('app.tenant_id'"), "app.tenant_id");
check("Organization repository valida pais/moneda/unidades", orgRepo.includes("COUNTRIES") && orgRepo.includes("CURRENCIES") && orgRepo.includes("UNIT_SYSTEMS"), "validation");
check("Organization repository guarda aceptacion con evidencia", orgRepo.includes("tenant_policy_acceptances") && orgRepo.includes("evidence_hash"), "policy evidence");
check("Organization repository audita cambios", orgRepo.includes("organization.settings.updated") && orgRepo.includes("compliance.policies.accepted"), "audit");
check("Organization repository gestiona preferencias privacidad", orgRepo.includes("getPrivacyPreferences") && orgRepo.includes("updatePrivacyPreferences"), "privacy repo");
check("Organization repository fuerza cookies necesarias", orgRepo.includes("necessary_cookies = true") && orgRepo.includes("compliance.privacy_preferences.updated"), "privacy audit");
check("Organization repository gestiona cuotas tenant", orgRepo.includes("getTenantUsage") && orgRepo.includes("updateTenantUsageLimits"), "usage repo");
check("Organization repository audita cuotas tenant", orgRepo.includes("organization.usage_limits.updated") && orgRepo.includes("storageUsagePercent"), "usage audit/status");

check("Service repository usa tenant context", serviceRepo.includes("set_config('app.tenant_id'"), "app.tenant_id");
check("Service repository no toma tenant desde input", !serviceRepo.includes("input.tenantId") && !serviceRepo.includes("body.tenantId"), "no tenant input");
check("Service repository valida unidades metricas/imperiales", serviceRepo.includes("IMPERIAL_UNITS") && serviceRepo.includes("METRIC_UNITS"), "unit validation");
check("Service repository archiva sin borrar", serviceRepo.includes("archiveService") && serviceRepo.includes('status: "archived"'), "soft archive");

check("Estimates guarda snapshot de pais/moneda/unidades", estimateRepo.includes("countryProfile") && estimateRepo.includes("documentLanguage") && estimateRepo.includes("service_snapshot"), "snapshot");
check("Estimates valida monedas soportadas", estimateRepo.includes("CURRENCIES") && estimateRepo.includes("USD") && estimateRepo.includes("COP") && estimateRepo.includes("EUR"), "currencies");
check("Estimates valida servicio por tenant", estimateRepo.includes("getActiveServiceForTenant") && estimateRepo.includes("tenant_id = $1"), "tenant service");
check("Facturas guardan snapshot fiscal", invoiceRepo.includes("createFiscalSnapshot") && invoiceRepo.includes("requiresExternalProvider") && invoiceRepo.includes("Documento operativo interno"), "fiscal snapshot");

check(
  "Runtime importa repos nuevos con pool compartido",
  server.includes("createPostgresOrganizationRepository(sharedPool)") && server.includes("createPostgresServiceCatalogRepository(sharedPool)"),
  "shared pool imports",
);
check("Runtime conecta handlers nuevos", server.includes("handleOrganizationRoute") && server.includes("handleServiceCatalogRoute"), "handlers");
check("Rutas incluyen servicios", routes.includes("/api/services/prices") && routes.includes("services-prices"), "services routes");
check("Rutas incluyen compliance", routes.includes("/api/compliance/policy-acceptances"), "policy routes");
check("Rutas incluyen preferencias privacidad", routes.includes("/api/compliance/privacy-preferences"), "privacy routes");
check("Rutas incluyen cuotas tenant", routes.includes("/api/organization/usage") && routes.includes("organization.manage"), "usage routes");
check("Manifest declara services-prices", manifest.includes("services-prices"), "manifest");
check("Manifest declara privacidad", manifest.includes("/api/compliance/privacy-preferences"), "privacy manifest");
check("Manifest declara cuotas tenant", manifest.includes("/api/organization/usage"), "usage manifest");

check("Workspace tiene drawer movil", workspace.includes("production-mobile-drawer") && workspace.includes("production-drawer-button"), "mobile drawer");
check("Workspace incluye ajustes y servicios", workspace.includes("TenantSettingsRealPage") && workspace.includes("ServiceCatalogRealPage"), "new pages");
check("Workspace avisa politicas pendientes", workspace.includes("requiredPoliciesAccepted") && workspace.includes("Privacidad y terminos pendientes"), "policy banner");
check("Workspace lee cuotas SaaS", workspace.includes("getTenantUsage") && workspace.includes("tenantUsage"), "usage workspace");
check("Workspace bloquea add-ons apagados", workspace.includes("AddonLockedPanel") && workspace.includes("marketingAddonEnabled === false"), "addon UX");
check("Workspace avisa limite almacenamiento", workspace.includes("Limite de almacenamiento alcanzado") && workspace.includes("TENANT_STORAGE_LIMIT_REACHED") === false, "storage UX");
check("API client expone privacidad", apiClient.includes("getPrivacyPreferences") && apiClient.includes("updatePrivacyPreferences"), "privacy client");
check("API client expone cuotas tenant", apiClient.includes("getTenantUsage") && apiClient.includes("updateTenantUsageLimits"), "usage client");
check("Settings page no usa mock data", !settingsPage.includes("mock-data"), "no mock");
check("Settings page permite aceptar politicas", settingsPage.includes("acceptRequiredPolicies") && settingsPage.includes("Registrar aceptacion"), "policies");
check("Settings page permite preferencias privacidad", settingsPage.includes("Cookies y comunicaciones") && settingsPage.includes("PreferenceToggle") && settingsPage.includes("updatePrivacyPreferences"), "privacy ui");
check("Settings page indica no esenciales apagadas", settingsPage.includes("No esenciales apagadas") && settingsPage.includes("No se activan rastreos"), "privacy copy");
check("Settings page muestra plan y cuotas", settingsPage.includes("Plan y cuotas") && settingsPage.includes("usage-meter"), "usage UI");
check("Settings page controla add-ons SaaS", settingsPage.includes("photoEvidenceEnabled") && settingsPage.includes("marketingAddonEnabled") && settingsPage.includes("dedicatedStorageEnabled"), "addon UI");
check("Services page no usa mock data", !servicesPage.includes("mock-data"), "no mock");
check("Services page crea y archiva servicios", servicesPage.includes("createService") && servicesPage.includes("archiveService"), "service actions");
check("Estimates page usa settings reales", estimatesPage.includes("getTenantSettings") && estimatesPage.includes("countryProfile"), "settings");
check("Estimates page usa catalogo servicios", estimatesPage.includes("listServices") && estimatesPage.includes("applyService"), "services");
check("Estimates page restringe monedas", estimatesPage.includes('<option value="USD">USD</option>') && estimatesPage.includes('<option value="COP">COP</option>') && estimatesPage.includes('<option value="EUR">EUR</option>'), "currencies");

check("Package script audit localization", Boolean(packageJson.scripts?.["audit:localization-services"]), "script");
check("Verify incluye audit localization", String(packageJson.scripts?.verify).includes("audit:localization-services"), "verify");

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Localization/services/compliance audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Localization/services/compliance audit passed with ${checks.length} checks.`);
