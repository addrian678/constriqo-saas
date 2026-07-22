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

const migration = readProjectFile("database/migrations/0033_marketing_runtime.sql");
const loyaltyMigration = readProjectFile("database/migrations/0034_marketing_loyalty_cards.sql");
const repository = readProjectFile("server/runtime/postgresMarketingRepository.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const routes = readProjectFile("server/runtime/runtimeRoutes.mjs");
const apiClient = readProjectFile("src/modules/marketing/api/marketingClient.ts");
const page = readProjectFile("src/modules/marketing/pages/MarketingRealPage.tsx");
const workspace = readProjectFile("src/app/ProductionWorkspace.tsx");
const localSmoke = readProjectFile("scripts/marketing-local-smoke.mjs");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("Migration amplia leads", migration.includes("ADD COLUMN IF NOT EXISTS email") && migration.includes("ADD COLUMN IF NOT EXISTS notes"), "lead fields");
check("Migration registra capacidades", migration.includes("marketing.read") && migration.includes("marketing.leads.convert"), "capabilities");
check("Migration crea tarjetas de fidelizacion", loyaltyMigration.includes("marketing_loyalty_cards") && loyaltyMigration.includes("card_code") && loyaltyMigration.includes("required_stamps"), "loyalty schema");
check("Repository activa tenant context", repository.includes("set_config('app.tenant_id'"), "tenant context");
check("Repository crea campanas", repository.includes("createCampaign") && repository.includes("INSERT INTO marketing_campaigns"), "campaigns");
check("Repository crea leads", repository.includes("createLead") && repository.includes("INSERT INTO marketing_leads"), "leads");
check("Repository convierte a CRM", repository.includes("convertLead") && repository.includes("INSERT INTO clients"), "convert");
check("Repository crea tarjetas de fidelizacion", repository.includes("createLoyaltyCard") && repository.includes("INSERT INTO marketing_loyalty_cards"), "loyalty");
check("Repository edita tarjetas de fidelizacion", repository.includes("updateLoyaltyCard") && repository.includes("marketing.loyalty_card.updated"), "loyalty update");
check("Repository genera codigo automatico de tarjeta", repository.includes("generateLoyaltyCardCode") && repository.includes("LOY-"), "loyalty code");
check("Repository exige consentimiento", repository.includes("consent_status !== \"accepted\""), "consent");
check("Repository escribe auditoria", repository.includes("INSERT INTO audit_events") && repository.includes("'marketing'"), "audit");
check("Repository no toma tenant desde input", !repository.includes("input.tenantId") && !repository.includes("body.tenantId"), "no tenant input");

check("Runtime importa repository con pool compartido", server.includes("createPostgresMarketingRepository(sharedPool)"), "shared pool import");
check("Runtime conecta modulo marketing", server.includes("handleMarketingRoute") && server.includes('route.moduleId === "marketing"'), "handler");
check("Runtime devuelve 503 si falta repository", server.includes("MARKETING_REPOSITORY_NOT_CONFIGURED"), "503");
check("Runtime bloquea marketing por add-on SaaS", server.includes("enforceTenantUsageGate") && server.includes("marketingAddonEnabled") && server.includes("ADDON_DISABLED"), "addon gate");
check("Runtime bloquea archivos por cuota", server.includes("TENANT_STORAGE_LIMIT_REACHED") && server.includes("/api/documents/cleanup-heavy-files"), "storage gate");
check("Rutas campaigns/leads/cards/convert", routes.includes("/api/marketing/campaigns") && routes.includes("/api/marketing/leads") && routes.includes("/api/marketing/loyalty-cards") && routes.includes("/api/marketing/loyalty-cards/:loyaltyCardId") && routes.includes("/api/marketing/leads/:marketingLeadId/convert"), "routes");

check("API cubre campanas leads tarjetas conversion", apiClient.includes("listMarketingCampaigns") && apiClient.includes("createMarketingLead") && apiClient.includes("createMarketingLoyaltyCard") && apiClient.includes("updateMarketingLoyaltyCard") && apiClient.includes("convertMarketingLead"), "api");
check("Pagina no usa mock data", !page.includes("mock-data") && !page.includes("marketingData"), "no mock");
check("Pagina oculta formularios por boton", page.includes("activePanel") && page.includes('activePanel === "campaign"') && page.includes('activePanel === "lead"') && page.includes('activePanel === "loyalty"'), "hidden forms");
check("Pagina muestra QR sin guardar archivo", page.includes("QrCodeSvg") && page.includes("CFLOY:") && !page.includes("download"), "qr local");
check("Pagina cierra formulario al guardar", page.includes("setActivePanel(null)") && page.includes("setMessage("), "close and notify");
check("Workspace conserva entrada de marketing", workspace.includes('label: "Marketing"') && workspace.includes('activeModule === "marketing"'), "workspace menu");
check("Workspace bloquea marketing para piloto", workspace.includes("Marketing proximamente") && workspace.includes("sus acciones permanecen bloqueadas") && !workspace.includes("<MarketingRealPage session={session} />"), "pilot lock");

check("Smoke valida aislamiento", localSmoke.includes("Tenant B no ve lead A"), "isolation smoke");
check("Smoke valida conversion CRM", localSmoke.includes("Lead convertido crea cliente CRM"), "conversion smoke");
check("Smoke valida tarjeta fidelizacion", localSmoke.includes("Tenant A crea tarjeta fidelizacion") && localSmoke.includes("Tenant A edita tarjeta fidelizacion") && localSmoke.includes("Tenant B no ve tarjeta A"), "loyalty smoke");
check("Smoke valida bloqueo por add-on", localSmoke.includes("Tenant A bloquea marketing si add-on esta apagado") && localSmoke.includes("ADDON_DISABLED"), "addon smoke");
check("Package script audit:marketing-real", Boolean(packageJson.scripts?.["audit:marketing-real"]), "audit script");
check("Package script smoke:marketing-local", Boolean(packageJson.scripts?.["smoke:marketing-local"]), "smoke script");

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Marketing real audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Marketing real audit passed with ${checks.length} checks.`);
