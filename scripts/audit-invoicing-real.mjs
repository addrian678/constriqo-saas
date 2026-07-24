import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const checks = [];

function readProjectFile(path) {
  const fullPath = join(root, path);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
}

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

const migration = readProjectFile("database/migrations/0027_invoicing_runtime.sql");
const documentMigration = readProjectFile("database/migrations/0028_invoicing_documents_credit_notes.sql");
const integrityMigration = readProjectFile("database/migrations/0048_sequences_payments_finance_integrity.sql");
const repository = readProjectFile("server/runtime/postgresInvoiceRepository.mjs");
const server = readProjectFile("server/runtime/server.mjs");
const routes = readProjectFile("server/runtime/runtimeRoutes.mjs");
const manifest = readProjectFile("server/runtime/runtimeManifest.mjs");
const pdfGenerator = readProjectFile("server/runtime/pdfDocumentGenerator.mjs");
const apiClient = readProjectFile("src/modules/invoicing/api/invoiceClient.ts");
const page = readProjectFile("src/modules/invoicing/pages/InvoicingRealPage.tsx");
const workspace = readProjectFile("src/app/ProductionWorkspace.tsx");
const smoke = readProjectFile("scripts/invoicing-local-smoke.mjs");
const packageJson = JSON.parse(readProjectFile("package.json") || "{}");

check("Migracion F9.2 existe", migration.includes("0027") || migration.includes("invoice_type"), "0027_invoicing_runtime");
check("Migracion agrega estimate_id", migration.includes("estimate_id uuid") && migration.includes("fk_invoices_tenant_estimate"), "estimate FK");
check("Migracion agrega campos fiscales/configurables", migration.includes("country_profile") && migration.includes("document_language") && migration.includes("billing_snapshot"), "country/language/snapshot");
check("Migracion agrega permisos", migration.includes("invoices.issue") && migration.includes("payments.record"), "capabilities");
check("Migracion F9.3 documentos/rectificativas existe", documentMigration.includes("corrects_invoice_id") && documentMigration.includes("receipt_number"), "0028");
check("Migracion F9.3 agrega permisos PDF/credit notes", documentMigration.includes("invoices.pdf.download") && documentMigration.includes("invoices.credit_notes.create"), "permissions");
check("Migracion integridad crea secuencias", integrityMigration.includes("document_sequences") && integrityMigration.includes("PRIMARY KEY (tenant_id, document_type, series, fiscal_year)"), "document_sequences");
check("Migracion integridad pagos idempotentes", integrityMigration.includes("idempotency_key") && integrityMigration.includes("uq_payments_tenant_idempotency_key"), "payments idempotency");
check("Migracion integridad cuentas por moneda", integrityMigration.includes("uq_financial_accounts_tenant_type_currency"), "currency accounts");
check("Repositorio usa tenant context", repository.includes("set_config('app.tenant_id'") && repository.includes("context.tenant.tenantId"), "tenant context");
check("Repositorio lista facturas por tenant", repository.includes("listInvoices") && repository.includes("i.tenant_id = $1"), "list");
check("Repositorio crea desde cotizacion aprobada", repository.includes("createInvoiceFromEstimate") && repository.includes("Solo se puede facturar una cotizacion aprobada"), "estimate flow");
check("Repositorio crea manual con partidas", repository.includes("createInvoiceFromItems") && repository.includes("La factura manual debe tener al menos una partida"), "manual flow");
check("Repositorio emite sin duplicar ledger", repository.includes("Solo una factura en borrador puede emitirse") && repository.includes("postInvoiceLedger"), "issue ledger");
check("Repositorio registra cobro", repository.includes("recordPayment") && repository.includes("postPaymentLedger"), "payment ledger");
check("Repositorio usa secuencias atomicas", repository.includes("nextDocumentSequence") && !repository.includes("count(*)::integer + 1 AS next_number"), "document sequences");
check("Repositorio bloquea factura al cobrar", repository.includes("requireInvoiceRowForUpdate") && repository.includes("FOR UPDATE"), "payment lock");
check("Repositorio exige idempotencia de cobro", repository.includes("idempotencyKey") && repository.includes("uq_payments_tenant_idempotency_key") === false, "idempotency runtime");
check("Repositorio rechaza sobrepago", repository.includes("El cobro supera el saldo pendiente") && !repository.includes("Math.min(clean.amount, currentBalance)"), "overpayment");
check("Repositorio bloquea status generico", repository.includes("solo puede cambiar mediante comandos explicitos"), "invoice FSM");
check("Repositorio filtra cuentas por moneda", repository.includes("account_type = $2 AND currency = $3"), "currency account lookup");
check("Repositorio archiva PDF factura", repository.includes("archiveInvoicePdf") && repository.includes("upsertGeneratedDocument"), "invoice pdf");
check("Repositorio archiva recibo PDF", repository.includes("archiveReceiptPdf") && repository.includes("receipt_number"), "receipt pdf");
check("Repositorio registra tamano PDF generado", repository.includes("recordGeneratedDocumentSize") && repository.includes("storage_size_bytes"), "pdf size");
check("Repositorio crea rectificativa", repository.includes("createCreditNote") && repository.includes("postCreditNoteLedger"), "credit note");
check("Repositorio escribe auditoria", repository.includes("INSERT INTO audit_events") && repository.includes("'invoicing'"), "audit");
check("Repositorio no acepta tenant del cliente", !repository.includes("x-tenant") && !repository.includes("tenantId: input"), "tenant spoofing");
check("Runtime importa invoice repository con pool compartido", server.includes("createPostgresInvoiceRepository(sharedPool)"), "shared pool import");
check("Runtime inicializa invoice repository", server.includes("const invoiceRepository") && server.includes("invoiceRepository,"), "init");
check("Runtime conecta handler invoicing", server.includes("handleInvoiceRoute") && server.includes('route.moduleId === "invoicing"'), "handler");
check("Runtime guarda tamano real PDF factura/recibo", server.includes("recordGeneratedDocumentSize") && server.includes("pdf.length"), "runtime pdf size");
check("Runtime devuelve 503 si no conectado", server.includes("INVOICE_REPOSITORY_NOT_CONFIGURED"), "503");
check("Rutas incluyen detalle", routes.includes("/api/invoicing/invoices/:invoiceId"), "detail");
check("Rutas incluyen emitir", routes.includes("/api/invoicing/invoices/:invoiceId/issue") && routes.includes("invoices.issue"), "issue");
check("Rutas incluyen pago por factura", routes.includes("/api/invoicing/invoices/:invoiceId/payments") && routes.includes("payments.record"), "payment");
check("Rutas incluyen PDF factura", routes.includes("/api/invoicing/invoices/:invoiceId/pdf") && routes.includes("invoices.pdf.download"), "invoice pdf route");
check("Rutas incluyen recibo PDF", routes.includes("/api/invoicing/invoices/:invoiceId/payments/:paymentId/receipt.pdf"), "receipt route");
check("Rutas incluyen rectificativas", routes.includes("/api/invoicing/invoices/:invoiceId/credit-notes") && routes.includes("invoices.credit_notes.create"), "credit route");
check("Manifest expone rutas nuevas", manifest.includes("/api/invoicing/invoices/:invoiceId/issue"), "manifest");
check("Manifest expone rutas PDF/rectificativa", manifest.includes("/api/invoicing/invoices/:invoiceId/pdf") && manifest.includes("/api/invoicing/invoices/:invoiceId/credit-notes"), "manifest pdf");
check("Generador PDF emite PDF valido", pdfGenerator.includes("%PDF-1.4") && pdfGenerator.includes("createInvoicePdfBuffer") && pdfGenerator.includes("createReceiptPdfBuffer"), "pdf generator");
check("API client real existe", apiClient.includes("listInvoices") && apiClient.includes("recordInvoicePayment"), "api client");
check("API client descarga PDFs", apiClient.includes("downloadInvoicePdf") && apiClient.includes("downloadReceiptPdf") && apiClient.includes("requestBlob"), "pdf client");
check("API client crea rectificativa", apiClient.includes("createCreditNote"), "credit client");
check("Pagina real no importa mock data", !page.includes("mock-data") && !page.includes("invoicingData"), "no mock");
check("Pagina crea factura", page.includes("handleCreate") && page.includes("createInvoice"), "create");
check("Pagina emite factura", page.includes("handleIssue") && page.includes("issueInvoice"), "issue");
check("Pagina cobra factura", page.includes("handlePayment") && page.includes("recordInvoicePayment"), "payment");
check("Pagina descarga PDF/recibo", page.includes("handleDownloadInvoice") && page.includes("handleDownloadReceipt"), "pdf ui");
check("Pagina abre PDF real para impresion", page.includes("openBlobInDocumentViewer") && page.includes("PDF real abierto para imprimir") && page.includes("Abrir PDF"), "real pdf print");
check("Pagina etiqueta partidas en movil", page.includes("line-item-mobile-heading") && page.includes("aria-label={`Cantidad de partida") && page.includes("placeholder=\"Precio unitario\""), "mobile item labels");
check("Pagina muestra detalle de factura en modal", page.includes("Detalle de factura") && page.includes("document-detail-modal") && page.includes("setSelectedInvoice(null)"), "detail modal");
check("Pagina permite agregar partida al final", page.includes("line-item-bottom-actions") && page.includes("Agregar otra partida"), "bottom add item");
check("Pagina explica conversion desde cotizacion", page.includes("selectedApprovedEstimate") && page.includes("Crear factura desde cotizacion") && page.includes("antes de generarla se pedira confirmacion"), "estimate selected notice");
check("Pagina confirma factura desde cotizacion", page.includes("confirmEstimateInvoice") && page.includes("Confirmar factura desde cotizacion") && page.includes("Si, crear factura"), "estimate invoice confirmation");
check("Pagina confirma emision y cobro", page.includes("Esta seguro de emitir esta factura?") && page.includes("Esta seguro de registrar este cobro?") && page.includes("Si, emitir factura") && page.includes("Confirmar cobro"), "issue/payment confirmation");
check("Pagina crea rectificativa", page.includes("handleCreditNote") && page.includes("createCreditNote"), "credit ui");
check("Pagina usa CRM y cotizaciones reales", page.includes("listCrmClients") && page.includes("listEstimates"), "real dependencies");
check("Workspace productivo incluye facturas", workspace.includes("<InvoicingRealPage") && workspace.includes('id: "invoicing"'), "workspace");
check("Smoke valida aislamiento", smoke.includes("Tenant B no ve factura A"), "tenant isolation");
check("Smoke valida ledger", smoke.includes("Factura genera ledger") && smoke.includes("Cobro genera ledger"), "ledger smoke");
check("Smoke valida PDFs", smoke.includes("Factura descarga PDF") && smoke.includes("Recibo descarga PDF") && smoke.includes("Rectificativa descarga PDF"), "pdf smoke");
check("Smoke valida tamano PDF", smoke.includes("Factura PDF registra tamano") && smoke.includes("Recibo PDF registra tamano"), "pdf size smoke");
check("Smoke valida rectificativa", smoke.includes("Tenant A crea rectificativa") && smoke.includes("Tenant B no rectifica factura A"), "credit smoke");
check("Smoke limpia fixtures", smoke.includes("DELETE FROM invoices") && smoke.includes("DELETE FROM tenants"), "cleanup");
check("Package script audit:invoicing-real", Boolean(packageJson.scripts?.["audit:invoicing-real"]), "package");
check("Package script smoke:invoicing-local", Boolean(packageJson.scripts?.["smoke:invoicing-local"]), "package");
check("Verify incluye audit:invoicing-real", String(packageJson.scripts?.verify).includes("audit:invoicing-real"), "verify");

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Invoicing real audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Invoicing real audit passed with ${checks.length} checks.`);
