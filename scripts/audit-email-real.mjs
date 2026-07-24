import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
let failures = 0;

function readProjectFile(relativePath) {
  const absolutePath = join(root, relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`ok - ${name}`);
    return;
  }
  failures += 1;
  console.error(`not ok - ${name}${detail ? ` (${detail})` : ""}`);
}

const migration = readProjectFile("database/migrations/0046_email_sandbox_delivery.sql");
const routes = readProjectFile("server/runtime/runtimeRoutes.mjs");
const manifest = readProjectFile("server/runtime/runtimeManifest.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const estimateRepo = readProjectFile("server/runtime/postgresEstimateRepository.mjs");
const invoiceRepo = readProjectFile("server/runtime/postgresInvoiceRepository.mjs");
const organizationRepo = readProjectFile("server/runtime/postgresOrganizationRepository.mjs");
const workforceRepo = readProjectFile("server/runtime/postgresWorkforceRepository.mjs");
const emailRuntime = readProjectFile("server/runtime/emailDeliveryRuntime.mjs");
const notificationsRepo = readProjectFile("server/runtime/postgresNotificationsRepository.mjs");
const estimatePage = readProjectFile("src/modules/estimates/pages/EstimatesRealPage.tsx");
const invoicePage = readProjectFile("src/modules/invoicing/pages/InvoicingRealPage.tsx");
const estimateClient = readProjectFile("src/modules/estimates/api/estimateClient.ts");
const invoiceClient = readProjectFile("src/modules/invoicing/api/invoiceClient.ts");
const manualEmailHelper = readProjectFile("src/shared/email/manualEmail.ts");
const notificationsClient = readProjectFile("src/modules/notifications/api/notificationsClient.ts");
const notificationsPage = readProjectFile("src/modules/notifications/pages/NotificationsAuditRealPage.tsx");
const smoke = readProjectFile("scripts/email-local-smoke.mjs");
const packageJson = JSON.parse(readProjectFile("package.json"));

check("Migration crea email_deliveries", migration.includes("CREATE TABLE IF NOT EXISTS email_deliveries") && migration.includes("sandboxed"), "email_deliveries");
check("Migration aplica RLS", migration.includes("ENABLE ROW LEVEL SECURITY") && migration.includes("email_deliveries_tenant_isolation"), "RLS");
check("Migration registra capacidades email", migration.includes("email.deliveries.read") && migration.includes("email.deliveries.send"), "capabilities");
check("Rutas email declaradas", routes.includes("/api/estimates/:estimateId/send-email") && routes.includes("/api/invoicing/invoices/:invoiceId/send-email") && routes.includes("/api/email/deliveries"), "routes");
check("Manifest publica rutas email", manifest.includes("/api/estimates/:estimateId/send-email") && manifest.includes("/api/invoicing/invoices/:invoiceId/send-email") && manifest.includes("/api/email/deliveries"), "manifest");
check("Runtime conecta handlers email", server.includes("queueEstimateEmail") && server.includes("queueInvoiceEmail"), "handlers");
check("Runtime email soporta sandbox y cola real", emailRuntime.includes("resolveEmailDeliveryConfig") && emailRuntime.includes('"smtp"') && emailRuntime.includes('"queued"') && emailRuntime.includes("EMAIL_FROM"), "email runtime");
check("Cotizaciones usan config de proveedor email", estimateRepo.includes("resolveEmailDeliveryConfig") && estimateRepo.includes("createEmailMetadata") && estimateRepo.includes("estimates.email.${delivery.status}"), "estimate repo");
check("Facturas usan config de proveedor email", invoiceRepo.includes("resolveEmailDeliveryConfig") && invoiceRepo.includes("createEmailMetadata") && invoiceRepo.includes("invoices.email.${delivery.status}"), "invoice repo");
check("Usuarios preparan email sin persistir clave", organizationRepo.includes("user.temporary_access") && organizationRepo.includes("user.password_reset") && organizationRepo.includes("passwordPersisted: false") && organizationRepo.includes("resolveEmailDeliveryConfig"), "organization repo");
check("Trabajadores preparan email con proveedor configurable", workforceRepo.includes("worker.temporary_access") && workforceRepo.includes("resolveEmailDeliveryConfig") && workforceRepo.includes("passwordPersisted: false"), "workforce repo");
check("Notificaciones listan historial email", notificationsRepo.includes("listEmailDeliveries") && notificationsRepo.includes("email_deliveries"), "notifications repo");
check("Frontend cotizaciones abre correo manual y conserva cola futura", estimatePage.includes("sendEstimateEmail") && estimatePage.includes("openManualEmailDraft") && estimatePage.includes("Enviar con mi correo"), "estimate manual email ui");
check("Frontend facturas abre correo manual y conserva cola futura", invoicePage.includes("sendInvoiceEmail") && invoicePage.includes("openManualEmailDraft") && invoicePage.includes("Enviar con mi correo"), "invoice manual email ui");
check("Helper email manual usa mailto aislado", manualEmailHelper.includes("mailto:") && manualEmailHelper.includes("ManualEmailDraft"), "manual email helper");
check("Clientes API email", estimateClient.includes("sendEstimateEmail") && invoiceClient.includes("sendInvoiceEmail"), "api clients");
check("UI muestra historial de correos preparados", notificationsClient.includes("listEmailDeliveries") && notificationsPage.includes("Correos preparados"), "notifications ui");
check("Smoke valida sandbox", smoke.includes("estimate email sandboxed") && smoke.includes("invoice email sandboxed") && smoke.includes("tenant B cannot send tenant A estimate") && smoke.includes("user access email sandboxed"), "smoke");
check("Package registra auditoria email", Boolean(packageJson.scripts?.["audit:email-real"]), "audit script");
check("Package registra smoke email", Boolean(packageJson.scripts?.["smoke:email-local"]), "smoke script");

if (failures > 0) {
  console.error(`Email audit failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log("Email audit passed.");
