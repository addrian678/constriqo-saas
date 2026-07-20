import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  ".env.example",
  "database/README.md",
  "database/migrations/0001_initial_schema.sql",
  "database/migrations/0002_authentication.sql",
  "database/migrations/0003_secure_storage.sql",
  "database/migrations/0004_events_audit_notifications.sql",
  "database/migrations/0005_crm_functional.sql",
  "database/migrations/0006_estimates_functional.sql",
  "database/migrations/0007_jobs_functional.sql",
  "database/migrations/0008_workforce_functional.sql",
  "database/migrations/0009_attendance_functional.sql",
  "database/migrations/0010_work_proofs_functional.sql",
  "database/migrations/0011_documents_functional.sql",
  "database/migrations/0012_invoicing_functional.sql",
  "database/migrations/0013_expenses_functional.sql",
  "database/migrations/0014_finance_functional.sql",
  "database/migrations/0015_assets_liabilities_functional.sql",
  "database/migrations/0016_organization_functional.sql",
  "database/migrations/0017_industry_profiles_functional.sql",
  "database/migrations/0018_marketing_functional.sql",
  "database/migrations/0020_tenant_integrity_hardening.sql",
  "database/migrations/0021_rls_and_secondary_tenant_integrity.sql",
  "database/migrations/0022_auth_mfa_runtime.sql",
  "database/migrations/0023_localization_services_compliance.sql",
  "database/migrations/0047_rls_audit_hardening.sql",
  "database/migrations/0048_sequences_payments_finance_integrity.sql",
  "database/migrations/0049_auth_rate_limit_tenant_slug_hardening.sql",
  "database/migrations/0050_fiscal_profiles_provider_readiness.sql",
  "database/migrations/0051_email_delivery_worker_outbox.sql",
  "database/migrations/0052_document_storage_persistence.sql",
  "database/migrations/0053_supabase_runtime_auth_rls.sql",
  "database/migrations/0054_supabase_runtime_license_rls.sql",
  "database/migrations/0055_supabase_readiness_schema_migrations_rls.sql",
  "database/seeds/0001_demo_seed.sql",
  "database/seeds/0002_auth_seed.sql",
  "database/seeds/0003_storage_seed.sql",
  "database/seeds/0004_events_seed.sql",
  "database/seeds/0005_crm_seed.sql",
  "database/seeds/0006_estimates_seed.sql",
  "database/seeds/0007_jobs_seed.sql",
  "database/seeds/0008_workforce_seed.sql",
  "database/seeds/0009_attendance_seed.sql",
  "database/seeds/0010_work_proofs_seed.sql",
  "database/seeds/0011_documents_seed.sql",
  "database/seeds/0012_invoicing_seed.sql",
  "database/seeds/0013_expenses_seed.sql",
  "database/seeds/0014_finance_seed.sql",
  "database/seeds/0015_assets_liabilities_seed.sql",
  "database/seeds/0016_organization_seed.sql",
  "database/seeds/0017_industry_profiles_seed.sql",
  "database/seeds/0018_marketing_seed.sql",
  "server/src/persistence/databaseConfig.ts",
  "server/src/persistence/repositoryContracts.ts",
  "server/src/auth/authPolicy.ts",
  "server/src/auth/authContracts.ts",
  "server/src/auth/authorization.ts",
  "server/src/auth/capabilityMatrix.ts",
  "server/src/auth/routeAuthorization.ts",
  "server/runtime/postgresAuthRepository.mjs",
  "server/runtime/cryptoAuth.mjs",
  "server/src/storage/storagePolicy.ts",
  "server/src/storage/storageContracts.ts",
  "server/src/storage/storageValidation.ts",
  "server/src/events/domainEvent.ts",
  "server/src/events/auditContracts.ts",
  "server/src/events/notificationContracts.ts",
  "server/src/modules/crm/crmDomain.ts",
  "server/src/modules/crm/crmRepository.ts",
  "server/src/modules/crm/crmRoutes.ts",
  "server/src/modules/estimates/estimateDomain.ts",
  "server/src/modules/estimates/estimateRepository.ts",
  "server/src/modules/estimates/estimateRoutes.ts",
  "server/src/modules/jobs/jobDomain.ts",
  "server/src/modules/jobs/jobRepository.ts",
  "server/src/modules/jobs/jobRoutes.ts",
  "server/src/modules/workforce/workforceDomain.ts",
  "server/src/modules/workforce/workforceRepository.ts",
  "server/src/modules/workforce/workforceRoutes.ts",
  "server/src/modules/attendance/attendanceDomain.ts",
  "server/src/modules/attendance/attendanceRepository.ts",
  "server/src/modules/attendance/attendanceRoutes.ts",
  "server/src/modules/work-proofs/workProofDomain.ts",
  "server/src/modules/work-proofs/workProofRepository.ts",
  "server/src/modules/work-proofs/workProofRoutes.ts",
  "server/src/modules/documents/documentDomain.ts",
  "server/src/modules/documents/documentRepository.ts",
  "server/src/modules/documents/documentRoutes.ts",
  "server/src/modules/invoicing/invoiceDomain.ts",
  "server/src/modules/invoicing/invoiceRepository.ts",
  "server/src/modules/invoicing/invoiceRoutes.ts",
  "server/src/modules/expenses/expenseDomain.ts",
  "server/src/modules/expenses/expenseRepository.ts",
  "server/src/modules/expenses/expenseRoutes.ts",
  "server/src/modules/finance/financeDomain.ts",
  "server/src/modules/finance/financeRepository.ts",
  "server/src/modules/finance/financeRoutes.ts",
  "server/src/modules/assets/assetsDomain.ts",
  "server/src/modules/assets/assetsRepository.ts",
  "server/src/modules/assets/assetsRoutes.ts",
  "server/src/modules/organization/organizationDomain.ts",
  "server/src/modules/organization/organizationRepository.ts",
  "server/src/modules/organization/organizationRoutes.ts",
  "server/src/modules/industry-validation/industryDomain.ts",
  "server/src/modules/industry-validation/industryRepository.ts",
  "server/src/modules/industry-validation/industryRoutes.ts",
  "server/src/modules/marketing/marketingDomain.ts",
  "server/src/modules/marketing/marketingRepository.ts",
  "server/src/modules/marketing/marketingRoutes.ts",
  "server/runtime/postgresOrganizationRepository.mjs",
  "server/runtime/postgresServiceCatalogRepository.mjs",
  "server/runtime/postgresJobRepository.mjs",
  "server/runtime/postgresWorkforceRepository.mjs",
];

const requiredTables = [
  "tenants",
  "users",
  "roles",
  "capabilities",
  "clients",
  "estimates",
  "jobs",
  "workers",
  "documents",
  "invoices",
  "expenses",
  "assets",
  "liabilities",
  "notifications",
  "audit_events",
];

const requiredAuthTables = [
  "auth_password_credentials",
  "auth_invitations",
  "auth_sessions",
  "auth_login_attempts",
];

const requiredStorageTables = [
  "storage_objects",
  "storage_object_versions",
  "storage_access_events",
];

const requiredEventTables = [
  "event_outbox",
  "notification_queue",
];

const requiredCrmTables = [
  "client_contacts",
  "client_activities",
  "client_notes",
];

const requiredEstimateTables = [
  "estimate_versions",
  "estimate_sections",
  "estimate_items",
  "estimate_approvals",
];

const requiredJobTables = [
  "job_phases",
  "job_tasks",
  "job_change_requests",
  "job_incidents",
];

const requiredWorkforceTables = [
  "worker_profiles",
  "worker_availability",
  "worker_certifications",
];

const requiredAttendanceTables = [
  "break_entries",
  "attendance_approvals",
  "attendance_exceptions",
];

const requiredWorkProofTables = [
  "work_proofs",
  "field_report_checklist_items",
  "field_report_materials",
];

const requiredDocumentTables = [
  "document_versions",
  "document_links",
  "document_permissions",
  "document_expiration_events",
];

const requiredInvoiceTables = [
  "invoice_items",
  "payments",
  "receipts",
  "invoice_status_history",
];

const requiredExpenseTables = [
  "vendors",
  "expense_items",
  "expense_payments",
  "expense_status_history",
];

const requiredFinanceTables = [
  "financial_accounts",
  "financial_transactions",
  "financial_reconciliations",
  "job_profitability_snapshots",
];

const requiredAssetsTables = [
  "asset_maintenance",
  "asset_depreciation_entries",
  "liability_payment_schedule",
  "liability_documents",
];

const requiredOrganizationTables = [
  "organization_settings",
  "tenant_feature_flags",
  "organization_change_log",
];

const requiredIndustryTables = [
  "tenant_industry_profiles",
  "industry_terms",
  "industry_module_overrides",
];

const requiredMarketingTables = [
  "marketing_campaigns",
  "marketing_leads",
  "marketing_followups",
  "marketing_message_templates",
  "marketing_reviews",
];

const requiredLocalizationServiceTables = [
  "service_catalog_items",
  "tenant_policy_acceptances",
];

const tenantScopedMigrationFiles = [
  "database/migrations/0001_initial_schema.sql",
  "database/migrations/0003_secure_storage.sql",
  "database/migrations/0004_events_audit_notifications.sql",
  "database/migrations/0005_crm_functional.sql",
  "database/migrations/0006_estimates_functional.sql",
  "database/migrations/0007_jobs_functional.sql",
  "database/migrations/0008_workforce_functional.sql",
  "database/migrations/0009_attendance_functional.sql",
  "database/migrations/0010_work_proofs_functional.sql",
  "database/migrations/0011_documents_functional.sql",
  "database/migrations/0012_invoicing_functional.sql",
  "database/migrations/0013_expenses_functional.sql",
  "database/migrations/0014_finance_functional.sql",
  "database/migrations/0015_assets_liabilities_functional.sql",
  "database/migrations/0016_organization_functional.sql",
  "database/migrations/0017_industry_profiles_functional.sql",
  "database/migrations/0018_marketing_functional.sql",
  "database/migrations/0019_commercial_security_functional.sql",
  "database/migrations/0020_tenant_integrity_hardening.sql",
  "database/migrations/0021_rls_and_secondary_tenant_integrity.sql",
  "database/migrations/0022_auth_mfa_runtime.sql",
  "database/migrations/0023_localization_services_compliance.sql",
];

const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

for (const file of requiredFiles) {
  check(`Archivo requerido ${file}`, existsSync(join(root, file)), file);
}

for (const file of tenantScopedMigrationFiles) {
  const migrationPathForTenant = join(root, file);
  if (existsSync(migrationPathForTenant)) {
    const migration = readFileSync(migrationPathForTenant, "utf8");
    check(`Migracion SaaS scoped ${file}`, migration.includes("tenant_id"), "tenant_id");
  }
}

const migrationPath = join(root, "database/migrations/0001_initial_schema.sql");
if (existsSync(migrationPath)) {
  const migration = readFileSync(migrationPath, "utf8");
  for (const table of requiredTables) {
    check(`Tabla ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Extension pgcrypto declarada", migration.includes("CREATE EXTENSION IF NOT EXISTS pgcrypto"), "pgcrypto");
  check("Audit events tiene tenant", migration.includes("audit_events") && migration.includes("tenant_id"), "tenant_id");
}

const authMigrationPath = join(root, "database/migrations/0002_authentication.sql");
if (existsSync(authMigrationPath)) {
  const migration = readFileSync(authMigrationPath, "utf8");
  for (const table of requiredAuthTables) {
    check(`Tabla auth ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Invitaciones usan token_hash", migration.includes("token_hash text NOT NULL"), "token_hash");
  check("Sesiones usan session_token_hash", migration.includes("session_token_hash text NOT NULL"), "session_token_hash");
  check("Credenciales declaran password_algorithm", migration.includes("password_algorithm text NOT NULL DEFAULT 'argon2id'"), "argon2id");
}

const tenantIntegrityMigrationPath = join(root, "database/migrations/0020_tenant_integrity_hardening.sql");
if (existsSync(tenantIntegrityMigrationPath)) {
  const migration = readFileSync(tenantIntegrityMigrationPath, "utf8");
  check("Tenant integrity migration agrega user_roles.tenant_id", migration.includes("ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS tenant_id"), "user_roles tenant_id");
  check("Tenant integrity blinda estimates-client", migration.includes("fk_estimates_tenant_client") && migration.includes("FOREIGN KEY (tenant_id, client_id)"), "estimates client");
  check("Tenant integrity blinda jobs-client", migration.includes("fk_jobs_tenant_client") && migration.includes("FOREIGN KEY (tenant_id, client_id)"), "jobs client");
  check("Tenant integrity blinda invoices-client", migration.includes("fk_invoices_tenant_client") && migration.includes("FOREIGN KEY (tenant_id, client_id)"), "invoices client");
  check("Tenant integrity blinda attendance-worker", migration.includes("fk_time_entries_tenant_worker") && migration.includes("FOREIGN KEY (tenant_id, worker_id)"), "time entries worker");
  check("Tenant integrity blinda documents-storage", migration.includes("fk_documents_tenant_storage_object") && migration.includes("FOREIGN KEY (tenant_id, storage_object_id)"), "documents storage");
  check("Tenant integrity blinda CRM contacts", migration.includes("fk_client_contacts_tenant_client"), "client contacts");
  check("Tenant integrity blinda marketing conversion", migration.includes("fk_marketing_leads_tenant_converted_client"), "marketing leads client");
}

const rlsMigrationPath = join(root, "database/migrations/0021_rls_and_secondary_tenant_integrity.sql");
if (existsSync(rlsMigrationPath)) {
  const migration = readFileSync(rlsMigrationPath, "utf8");
  check("RLS migration habilita row level security", migration.includes("ENABLE ROW LEVEL SECURITY"), "RLS");
  check("RLS migration fuerza row level security", migration.includes("FORCE ROW LEVEL SECURITY"), "FORCE RLS");
  check("RLS migration crea policy tenant isolation", migration.includes("CREATE POLICY") && migration.includes("app.tenant_id"), "tenant policy");
  check("RLS migration cubre document permissions", migration.includes("fk_document_permissions_tenant_role") && migration.includes("fk_document_permissions_tenant_user"), "document permissions");
  check("RLS migration cubre job incidents field report", migration.includes("fk_job_incidents_tenant_field_report"), "job incidents");
  check("RLS migration conserva borrado de job phase", migration.includes("clear_job_phase_on_delete"), "job phase cleanup");
}

const rlsAuditHardeningPath = join(root, "database/migrations/0047_rls_audit_hardening.sql");
if (existsSync(rlsAuditHardeningPath)) {
  const migration = readFileSync(rlsAuditHardeningPath, "utf8");
  check("RLS hardening cubre marketing loyalty cards", migration.includes("'marketing_loyalty_cards'") && migration.includes("ENABLE ROW LEVEL SECURITY"), "marketing_loyalty_cards");
  check("RLS hardening cubre notification preferences", migration.includes("'notification_preferences'") && migration.includes("FORCE ROW LEVEL SECURITY"), "notification_preferences");
  check("RLS hardening cubre email deliveries", migration.includes("'email_deliveries'") && migration.includes("app.tenant_id"), "email_deliveries");
  check("RLS hardening agrega FK tenant user preferencias", migration.includes("fk_notification_preferences_tenant_user") && migration.includes("FOREIGN KEY (tenant_id, user_id)"), "notification preferences FK");
  check("RLS hardening agrega FK tenant queued_by email", migration.includes("fk_email_deliveries_tenant_queued_by") && migration.includes("FOREIGN KEY (tenant_id, queued_by_user_id)"), "email FK");
  check("Audit events son append-only", migration.includes("prevent_audit_event_mutation") && migration.includes("BEFORE UPDATE OR DELETE ON audit_events"), "audit append-only");
  check("Super admin audit es append-only", migration.includes("BEFORE UPDATE OR DELETE ON super_admin_audit_events"), "super admin audit append-only");
}

const sequenceIntegrityPath = join(root, "database/migrations/0048_sequences_payments_finance_integrity.sql");
if (existsSync(sequenceIntegrityPath)) {
  const migration = readFileSync(sequenceIntegrityPath, "utf8");
  check("Document sequences crea tabla atomica", migration.includes("CREATE TABLE IF NOT EXISTS document_sequences") && migration.includes("PRIMARY KEY (tenant_id, document_type, series, fiscal_year)"), "document_sequences");
  check("Document sequences aplica RLS", migration.includes("ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY") && migration.includes("document_sequences_tenant_isolation"), "document_sequences RLS");
  check("Payments agrega idempotency key", migration.includes("ADD COLUMN IF NOT EXISTS idempotency_key") && migration.includes("uq_payments_tenant_idempotency_key"), "payments idempotency");
  check("Financial accounts unicas por moneda", migration.includes("uq_financial_accounts_tenant_type_currency") && migration.includes("UNIQUE (tenant_id, account_type, currency)"), "account currency unique");
}

const authRateLimitPath = join(root, "database/migrations/0049_auth_rate_limit_tenant_slug_hardening.sql");
if (existsSync(authRateLimitPath)) {
  const migration = readFileSync(authRateLimitPath, "utf8");
  check("Auth rate limit indexa intentos fallidos", migration.includes("idx_auth_login_attempts_tenant_email_failed_recent") && migration.includes("WHERE succeeded = false"), "failed attempts index");
  check("Tenant slug publico es unico", migration.includes("uq_tenants_tenant_slug_public_code") && migration.includes("ON tenants (tenant_slug)"), "tenant slug unique");
  check("Tenant slug no debe exponer UUID", migration.includes("Do not expose tenant UUIDs as public customer codes"), "tenant slug comment");
}

const fiscalProvidersPath = join(root, "database/migrations/0050_fiscal_profiles_provider_readiness.sql");
if (existsSync(fiscalProvidersPath)) {
  const migration = readFileSync(fiscalProvidersPath, "utf8");
  check("Fiscal profiles crea tabla por tenant", migration.includes("CREATE TABLE IF NOT EXISTS tenant_fiscal_profiles") && migration.includes("requires_external_provider"), "tenant_fiscal_profiles");
  check("Provider settings no guardan secretos planos", migration.includes("CREATE TABLE IF NOT EXISTS tenant_provider_settings") && migration.includes("secret_ref") && migration.includes("Secrets must live"), "provider settings");
  check("Fiscal/provider settings aplican RLS", migration.includes("tenant_fiscal_profiles_tenant_isolation") && migration.includes("tenant_provider_settings_tenant_isolation"), "RLS providers");
  check("Fiscal/provider capabilities admin", migration.includes("organization.providers.manage") && migration.includes("organization.fiscal.manage"), "capabilities");
}

const emailWorkerPath = join(root, "database/migrations/0051_email_delivery_worker_outbox.sql");
if (existsSync(emailWorkerPath)) {
  const migration = readFileSync(emailWorkerPath, "utf8");
  check("Email worker agrega outbox robusto", migration.includes("attempt_count") && migration.includes("next_attempt_at") && migration.includes("worker_locked_until"), "email worker columns");
  check("Email worker indexa cola", migration.includes("idx_email_deliveries_worker_queue") && migration.includes("WHERE status IN ('queued', 'failed')"), "worker queue index");
}

const documentStoragePath = join(root, "database/migrations/0052_document_storage_persistence.sql");
if (existsSync(documentStoragePath)) {
  const migration = readFileSync(documentStoragePath, "utf8");
  check("Document storage persistence agrega proveedor", migration.includes("storage_provider") && migration.includes("storage_uploaded_at"), "document storage persistence");
  check("Document storage persistence agrega checksum", migration.includes("storage_checksum_sha256") && migration.includes("storage_persisted"), "checksum");
}

const mfaMigrationPath = join(root, "database/migrations/0022_auth_mfa_runtime.sql");
if (existsSync(mfaMigrationPath)) {
  const migration = readFileSync(mfaMigrationPath, "utf8");
  check("MFA migration crea factores", migration.includes("CREATE TABLE IF NOT EXISTS auth_mfa_factors"), "auth_mfa_factors");
  check("MFA migration crea challenges", migration.includes("CREATE TABLE IF NOT EXISTS auth_mfa_challenges"), "auth_mfa_challenges");
  check("MFA migration crea recovery codes", migration.includes("CREATE TABLE IF NOT EXISTS auth_recovery_codes"), "auth_recovery_codes");
  check("MFA migration prepara secreto cifrado", migration.includes("secret_ciphertext"), "secret_ciphertext");
  check("MFA migration separa iv/tag", migration.includes("secret_iv") && migration.includes("secret_tag"), "iv/tag");
  check("MFA migration usa token hash", migration.includes("challenge_token_hash"), "challenge_token_hash");
  check("MFA migration habilita RLS", migration.includes("ENABLE ROW LEVEL SECURITY") && migration.includes("app.tenant_id"), "RLS");
  check("MFA migration fuerza RLS", migration.includes("FORCE ROW LEVEL SECURITY"), "FORCE RLS");
}

const localizationServicesMigrationPath = join(root, "database/migrations/0023_localization_services_compliance.sql");
if (existsSync(localizationServicesMigrationPath)) {
  const migration = readFileSync(localizationServicesMigrationPath, "utf8");
  for (const table of requiredLocalizationServiceTables) {
    check(`Tabla localization/services ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Tenant settings agrega country/unit/language", migration.includes("country_profile") && migration.includes("unit_system") && migration.includes("document_language"), "tenant settings");
  check("Service catalog usa tenant_id", migration.includes("service_catalog_items") && migration.includes("tenant_id uuid NOT NULL REFERENCES tenants"), "tenant_id");
  check("Policy acceptances usa evidencia hash", migration.includes("evidence_hash text NOT NULL"), "evidence_hash");
  check("Estimate items enlaza service catalog por tenant", migration.includes("fk_estimate_items_tenant_service_catalog") && migration.includes("FOREIGN KEY (tenant_id, service_catalog_item_id)"), "service FK");
  check("Localization/services habilita RLS", migration.includes("ENABLE ROW LEVEL SECURITY") && migration.includes("app.tenant_id"), "RLS");
  check("Localization/services fuerza RLS", migration.includes("FORCE ROW LEVEL SECURITY"), "FORCE RLS");
}

const runtimeAuthRepositoryPath = join(root, "server/runtime/postgresAuthRepository.mjs");
if (existsSync(runtimeAuthRepositoryPath)) {
  const repository = readFileSync(runtimeAuthRepositoryPath, "utf8");
  check("Runtime auth usa pg Pool", repository.includes("new Pool"), "pg Pool");
  check("Runtime auth verifica Argon2", repository.includes("verifyPassword") && repository.includes("passwordHash"), "argon2");
  check("Runtime auth guarda sesiones hash-only", repository.includes("session_token_hash") && repository.includes("hashSessionToken"), "session hash");
  check("Runtime auth exige MFA admin", repository.includes("requireAdminMfa") && repository.includes("MFA_SETUP_REQUIRED"), "admin MFA");
  check("Runtime auth crea retos MFA hash-only", repository.includes("auth_mfa_challenges") && repository.includes("challenge_token_hash"), "mfa challenges");
  check("Runtime auth cifra secreto TOTP", repository.includes("encryptSecret(secret)") && repository.includes("decryptSecret"), "encrypted TOTP");
  check("Runtime auth verifica TOTP", repository.includes("verifyTotpCode"), "verify TOTP");
  check("Runtime auth activa tenant context", repository.includes("set_config('app.tenant_id'"), "app.tenant_id");
  check("Runtime auth usa tokens scoped por tenant", repository.includes("createScopedToken") && repository.includes("extractTenantIdFromScopedToken"), "tenant token");
  check("Runtime auth deriva roles/capabilities de DB", repository.includes("role_capabilities") && repository.includes("capabilities"), "capabilities");
}

const authPolicyPath = join(root, "server/src/auth/authPolicy.ts");
if (existsSync(authPolicyPath)) {
  const policy = readFileSync(authPolicyPath, "utf8");
  check("Registro publico deshabilitado", policy.includes("publicRegistration: false"), "publicRegistration false");
  check("Tokens solo hash", policy.includes('tokenStorage: "hash-only"'), "hash-only");
  check("Argon2 requerido", policy.includes('passwordHash: "argon2id-required"'), "argon2id-required");
}

const capabilityMatrixPath = join(root, "server/src/auth/capabilityMatrix.ts");
if (existsSync(capabilityMatrixPath)) {
  const matrix = readFileSync(capabilityMatrixPath, "utf8");
  check("Matriz incluye admin", matrix.includes("admin:"), "admin");
  check("Matriz incluye manager", matrix.includes("manager:"), "manager");
  check("Matriz incluye worker", matrix.includes("worker:"), "worker");
  check("Capacidades se derivan de moduleRegistry", matrix.includes("moduleRegistry"), "moduleRegistry");
}

const storageMigrationPath = join(root, "database/migrations/0003_secure_storage.sql");
if (existsSync(storageMigrationPath)) {
  const migration = readFileSync(storageMigrationPath, "utf8");
  for (const table of requiredStorageTables) {
    check(`Tabla storage ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Documents referencia storage_object_id", migration.includes("storage_object_id uuid REFERENCES storage_objects"), "documents.storage_object_id");
  check("Storage aislado por tenant", migration.includes("tenant_id uuid NOT NULL REFERENCES tenants"), "tenant_id");
}

const storagePolicyPath = join(root, "server/src/storage/storagePolicy.ts");
if (existsSync(storagePolicyPath)) {
  const policy = readFileSync(storagePolicyPath, "utf8");
  check("Storage provider no configurado", policy.includes('provider: "not-configured"'), "provider");
  check("Storage soporta Supabase/S3/local", policy.includes("supabase-storage") && policy.includes("s3-compatible") && policy.includes("local-dev"), "providers");
  check("Storage define cuota por tenant", policy.includes("tenantQuotaMbDefault"), "tenant quota");
  check("Storage limpieza pesada exige 2FA", policy.includes("heavyFileCleanupRequires") && policy.includes('"2fa"'), "2FA cleanup");
  check("Storage exige tenant isolation", policy.includes('tenantIsolation: "required"'), "tenantIsolation");
  check("Storage exige virus scan futuro", policy.includes('virusScan: "required-before-production"'), "virusScan");
  check("Storage define URLs temporales", policy.includes("signedUrlExpiryMinutes"), "signedUrlExpiryMinutes");
}

const eventsMigrationPath = join(root, "database/migrations/0004_events_audit_notifications.sql");
if (existsSync(eventsMigrationPath)) {
  const migration = readFileSync(eventsMigrationPath, "utf8");
  for (const table of requiredEventTables) {
    check(`Tabla eventos ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Audit events tiene severity", migration.includes("ADD COLUMN IF NOT EXISTS severity"), "severity");
  check("Outbox tiene reintentos", migration.includes("attempts integer NOT NULL DEFAULT 0"), "attempts");
  check("Notification queue usa in_app por defecto", migration.includes("channel text NOT NULL DEFAULT 'in_app'"), "in_app");
}

const notificationContractsPath = join(root, "server/src/events/notificationContracts.ts");
if (existsSync(notificationContractsPath)) {
  const contracts = readFileSync(notificationContractsPath, "utf8");
  check("Canal activo solo in_app", contracts.includes('enabledChannels: ["in_app"]'), "in_app only");
  check("Push/email/SMS requieren consentimiento futuro", contracts.includes("push_future") && contracts.includes("futureChannelsRequireConsent"), "consent");
}

const crmMigrationPath = join(root, "database/migrations/0005_crm_functional.sql");
if (existsSync(crmMigrationPath)) {
  const migration = readFileSync(crmMigrationPath, "utf8");
  for (const table of requiredCrmTables) {
    check(`Tabla CRM ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("CRM contactos aislados por tenant", migration.includes("client_contacts") && migration.includes("tenant_id uuid NOT NULL REFERENCES tenants"), "tenant_id");
  check("CRM actividades auditan usuario creador", migration.includes("created_by_user_id uuid REFERENCES users"), "created_by_user_id");
}

const crmRoutesPath = join(root, "server/src/modules/crm/crmRoutes.ts");
if (existsSync(crmRoutesPath)) {
  const routes = readFileSync(crmRoutesPath, "utf8");
  check("CRM API lista clientes", routes.includes("/api/crm/clients"), "clients route");
  check("CRM API exige clients.create", routes.includes('capability: "clients.create"'), "clients.create");
  check("CRM API exige clients.update", routes.includes('capability: "clients.update"'), "clients.update");
}

const estimatesMigrationPath = join(root, "database/migrations/0006_estimates_functional.sql");
if (existsSync(estimatesMigrationPath)) {
  const migration = readFileSync(estimatesMigrationPath, "utf8");
  for (const table of requiredEstimateTables) {
    check(`Tabla estimates ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Estimates version tiene snapshot", migration.includes("snapshot jsonb NOT NULL DEFAULT '{}'::jsonb"), "snapshot");
  check("Estimates approvals registra usuario", migration.includes("approved_by_user_id uuid REFERENCES users"), "approved_by_user_id");
}

const estimateRoutesPath = join(root, "server/src/modules/estimates/estimateRoutes.ts");
if (existsSync(estimateRoutesPath)) {
  const routes = readFileSync(estimateRoutesPath, "utf8");
  check("Estimates API lista", routes.includes("/api/estimates"), "estimates route");
  check("Estimates API exige create", routes.includes('capability: "estimates.create"'), "estimates.create");
  check("Estimates API exige approve", routes.includes('capability: "estimates.approve"'), "estimates.approve");
}

const jobsMigrationPath = join(root, "database/migrations/0007_jobs_functional.sql");
if (existsSync(jobsMigrationPath)) {
  const migration = readFileSync(jobsMigrationPath, "utf8");
  for (const table of requiredJobTables) {
    check(`Tabla jobs ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Job tasks asignan worker", migration.includes("assigned_to_worker_id uuid REFERENCES workers"), "assigned_to_worker_id");
  check("Job change requests registran aprobador", migration.includes("approved_by_user_id uuid REFERENCES users"), "approved_by_user_id");
}

const jobRoutesPath = join(root, "server/src/modules/jobs/jobRoutes.ts");
if (existsSync(jobRoutesPath)) {
  const routes = readFileSync(jobRoutesPath, "utf8");
  check("Jobs API lista", routes.includes("/api/jobs"), "jobs route");
  check("Jobs API exige create", routes.includes('capability: "jobs.create"'), "jobs.create");
  check("Jobs API exige update", routes.includes('capability: "jobs.update"'), "jobs.update");
}

const workforceMigrationPath = join(root, "database/migrations/0008_workforce_functional.sql");
if (existsSync(workforceMigrationPath)) {
  const migration = readFileSync(workforceMigrationPath, "utf8");
  for (const table of requiredWorkforceTables) {
    check(`Tabla workforce ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Worker certifications enlaza documents", migration.includes("document_id uuid REFERENCES documents"), "document_id");
  check("Worker availability unica por fecha", migration.includes("UNIQUE (tenant_id, worker_id, availability_date)"), "availability unique");
}

const workforceRoutesPath = join(root, "server/src/modules/workforce/workforceRoutes.ts");
if (existsSync(workforceRoutesPath)) {
  const routes = readFileSync(workforceRoutesPath, "utf8");
  check("Workforce API lista workers", routes.includes("/api/workforce/workers"), "workers route");
  check("Workforce API exige read", routes.includes('capability: "workforce.read"'), "workforce.read");
  check("Workforce API exige manage", routes.includes('capability: "workforce.manage"'), "workforce.manage");
}

const attendanceMigrationPath = join(root, "database/migrations/0009_attendance_functional.sql");
if (existsSync(attendanceMigrationPath)) {
  const migration = readFileSync(attendanceMigrationPath, "utf8");
  for (const table of requiredAttendanceTables) {
    check(`Tabla attendance ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Attendance registra server_recorded", migration.includes("server_recorded boolean NOT NULL DEFAULT true"), "server_recorded");
  check("Attendance approvals tiene reviewer", migration.includes("reviewed_by_user_id uuid NOT NULL REFERENCES users"), "reviewed_by_user_id");
}

const attendanceRoutesPath = join(root, "server/src/modules/attendance/attendanceRoutes.ts");
if (existsSync(attendanceRoutesPath)) {
  const routes = readFileSync(attendanceRoutesPath, "utf8");
  check("Attendance API clock-in", routes.includes("/api/attendance/clock-in"), "clock-in");
  check("Attendance API clock-out", routes.includes("/api/attendance/clock-out"), "clock-out");
  check("Attendance API exige review", routes.includes('capability: "attendance.review.visual"'), "attendance.review.visual");
}

const workProofMigrationPath = join(root, "database/migrations/0010_work_proofs_functional.sql");
if (existsSync(workProofMigrationPath)) {
  const migration = readFileSync(workProofMigrationPath, "utf8");
  for (const table of requiredWorkProofTables) {
    check(`Tabla work-proofs ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Work proofs enlaza storage", migration.includes("storage_object_id uuid REFERENCES storage_objects"), "storage_object_id");
  check("Job incidents enlaza field report", migration.includes("field_report_id uuid REFERENCES field_reports"), "field_report_id");
}

const workProofRoutesPath = join(root, "server/src/modules/work-proofs/workProofRoutes.ts");
if (existsSync(workProofRoutesPath)) {
  const routes = readFileSync(workProofRoutesPath, "utf8");
  check("Work proofs API field reports", routes.includes("/api/work-proofs/field-reports"), "field reports");
  check("Work proofs API exige create", routes.includes('capability: "field-reports.create"'), "field-reports.create");
  check("Work proofs API pruebas worker", routes.includes('capability: "proofs.self.visual"'), "proofs.self.visual");
}

const documentsMigrationPath = join(root, "database/migrations/0011_documents_functional.sql");
if (existsSync(documentsMigrationPath)) {
  const migration = readFileSync(documentsMigrationPath, "utf8");
  for (const table of requiredDocumentTables) {
    check(`Tabla documents ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Document versions enlaza storage", migration.includes("storage_object_id uuid REFERENCES storage_objects"), "storage_object_id");
  check("Document permissions por rol o usuario", migration.includes("role_id uuid REFERENCES roles") && migration.includes("user_id uuid REFERENCES users"), "permissions");
}

const documentRoutesPath = join(root, "server/src/modules/documents/documentRoutes.ts");
if (existsSync(documentRoutesPath)) {
  const routes = readFileSync(documentRoutesPath, "utf8");
  check("Documents API lista", routes.includes("/api/documents"), "documents route");
  check("Documents API exige create", routes.includes('capability: "documents.create"'), "documents.create");
  check("Documents API exige update", routes.includes('capability: "documents.update"'), "documents.update");
}

const invoicingMigrationPath = join(root, "database/migrations/0012_invoicing_functional.sql");
if (existsSync(invoicingMigrationPath)) {
  const migration = readFileSync(invoicingMigrationPath, "utf8");
  for (const table of requiredInvoiceTables) {
    check(`Tabla invoicing ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Payments registran usuario", migration.includes("recorded_by_user_id uuid REFERENCES users"), "recorded_by_user_id");
  check("Receipts enlazan documento", migration.includes("document_id uuid REFERENCES documents"), "receipt document");
}

const invoiceRoutesPath = join(root, "server/src/modules/invoicing/invoiceRoutes.ts");
if (existsSync(invoiceRoutesPath)) {
  const routes = readFileSync(invoiceRoutesPath, "utf8");
  check("Invoicing API lista invoices", routes.includes("/api/invoicing/invoices"), "invoices route");
  check("Invoicing API exige create", routes.includes('capability: "invoices.create"'), "invoices.create");
  check("Invoicing API exige payments.record", routes.includes('capability: "payments.record"'), "payments.record");
}

const expensesMigrationPath = join(root, "database/migrations/0013_expenses_functional.sql");
if (existsSync(expensesMigrationPath)) {
  const migration = readFileSync(expensesMigrationPath, "utf8");
  for (const table of requiredExpenseTables) {
    check(`Tabla expenses ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Expenses aprobador", migration.includes("approved_by_user_id uuid REFERENCES users"), "approved_by_user_id");
  check("Expense payments registran usuario", migration.includes("recorded_by_user_id uuid REFERENCES users"), "recorded_by_user_id");
}

const expenseRoutesPath = join(root, "server/src/modules/expenses/expenseRoutes.ts");
if (existsSync(expenseRoutesPath)) {
  const routes = readFileSync(expenseRoutesPath, "utf8");
  check("Expenses API lista", routes.includes("/api/expenses"), "expenses route");
  check("Expenses API exige create", routes.includes('capability: "expenses.create"'), "expenses.create");
  check("Expenses API exige approve", routes.includes('capability: "expenses.approve"'), "expenses.approve");
}

const financeMigrationPath = join(root, "database/migrations/0014_finance_functional.sql");
if (existsSync(financeMigrationPath)) {
  const migration = readFileSync(financeMigrationPath, "utf8");
  for (const table of requiredFinanceTables) {
    check(`Tabla finance ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Finance transactions enlazan entidad", migration.includes("related_entity_type text") && migration.includes("related_entity_id uuid"), "related entity");
  check("Finance reconciliations reviewer", migration.includes("reviewed_by_user_id uuid REFERENCES users"), "reviewed_by_user_id");
}

const financeRoutesPath = join(root, "server/src/modules/finance/financeRoutes.ts");
if (existsSync(financeRoutesPath)) {
  const routes = readFileSync(financeRoutesPath, "utf8");
  check("Finance API accounts", routes.includes("/api/finance/accounts"), "accounts");
  check("Finance API cashflow read", routes.includes('capability: "cashflow.read"'), "cashflow.read");
  check("Finance API manage", routes.includes('capability: "finance.manage"'), "finance.manage");
}

const assetsMigrationPath = join(root, "database/migrations/0015_assets_liabilities_functional.sql");
if (existsSync(assetsMigrationPath)) {
  const migration = readFileSync(assetsMigrationPath, "utf8");
  for (const table of requiredAssetsTables) {
    check(`Tabla assets ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Asset depreciation metodo manual", migration.includes("method text NOT NULL DEFAULT 'manual'"), "manual depreciation");
  check("Liability documents enlazan documents", migration.includes("document_id uuid NOT NULL REFERENCES documents"), "liability documents");
}

const assetsRoutesPath = join(root, "server/src/modules/assets/assetsRoutes.ts");
if (existsSync(assetsRoutesPath)) {
  const routes = readFileSync(assetsRoutesPath, "utf8");
  check("Assets API lista assets", routes.includes("/api/assets"), "assets route");
  check("Assets API exige manage", routes.includes('capability: "assets.manage"'), "assets.manage");
  check("Liabilities API exige read", routes.includes('capability: "liabilities.read"'), "liabilities.read");
}

const organizationMigrationPath = join(root, "database/migrations/0016_organization_functional.sql");
if (existsSync(organizationMigrationPath)) {
  const migration = readFileSync(organizationMigrationPath, "utf8");
  for (const table of requiredOrganizationTables) {
    check(`Tabla organization ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Organization settings unico por tenant", migration.includes("UNIQUE (tenant_id, setting_key)"), "setting unique");
  check("Feature flags unico por tenant", migration.includes("UNIQUE (tenant_id, module_id)"), "feature flag unique");
}

const organizationRoutesPath = join(root, "server/src/modules/organization/organizationRoutes.ts");
if (existsSync(organizationRoutesPath)) {
  const routes = readFileSync(organizationRoutesPath, "utf8");
  check("Organization API settings", routes.includes("/api/organization/settings"), "settings");
  check("Organization API exige manage", routes.includes('capability: "organization.manage"'), "organization.manage");
  check("Organization API feature flags", routes.includes("/api/organization/feature-flags/:moduleId"), "feature flags");
}

const industryMigrationPath = join(root, "database/migrations/0017_industry_profiles_functional.sql");
if (existsSync(industryMigrationPath)) {
  const migration = readFileSync(industryMigrationPath, "utf8");
  for (const table of requiredIndustryTables) {
    check(`Tabla industry ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Industry terms unico por perfil", migration.includes("UNIQUE (tenant_id, profile_id, term_key)"), "terms unique");
  check("Industry overrides jsonb", migration.includes("override_config jsonb NOT NULL DEFAULT '{}'::jsonb"), "override_config");
}

const industryRoutesPath = join(root, "server/src/modules/industry-validation/industryRoutes.ts");
if (existsSync(industryRoutesPath)) {
  const routes = readFileSync(industryRoutesPath, "utf8");
  check("Industry API profiles", routes.includes("/api/industry/profiles"), "profiles");
  check("Industry API prepare", routes.includes("/api/industry/profiles/:profileId/prepare"), "prepare");
  check("Industry API exige validation read", routes.includes('capability: "industry.validation.read.visual"'), "industry.validation.read.visual");
}

const marketingMigrationPath = join(root, "database/migrations/0018_marketing_functional.sql");
if (existsSync(marketingMigrationPath)) {
  const migration = readFileSync(marketingMigrationPath, "utf8");
  for (const table of requiredMarketingTables) {
    check(`Tabla marketing ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), table);
  }
  check("Marketing leads exige consentimiento", migration.includes("consent_status text NOT NULL DEFAULT 'pending'"), "consent_status");
  check("Marketing convierte a clients", migration.includes("converted_client_id uuid REFERENCES clients(client_id)"), "converted_client_id");
  check("Marketing followups aislado por tenant", migration.includes("marketing_followups") && migration.includes("tenant_id uuid NOT NULL REFERENCES tenants"), "tenant_id");
}

const marketingRoutesPath = join(root, "server/src/modules/marketing/marketingRoutes.ts");
if (existsSync(marketingRoutesPath)) {
  const routes = readFileSync(marketingRoutesPath, "utf8");
  check("Marketing API lista campanas", routes.includes("/api/marketing/campaigns"), "campaigns");
  check("Marketing API exige manage", routes.includes('capability: "marketing.manage"'), "marketing.manage");
  check("Marketing API convierte leads", routes.includes("/api/marketing/leads/:marketingLeadId/convert"), "convert");
  check("Marketing API exige conversion segura", routes.includes('capability: "marketing.leads.convert"'), "marketing.leads.convert");
}

const routeAuthorizationPath = join(root, "server/src/auth/routeAuthorization.ts");
if (existsSync(routeAuthorizationPath)) {
  const guard = readFileSync(routeAuthorizationPath, "utf8");
  check("Rutas API requieren capability", guard.includes("requireCapability(context, route.capability)"), "requireCapability");
  check("Denegaciones preparan audit event", guard.includes("authorization.denied"), "authorization.denied");
}

const envPath = join(root, ".env.example");
if (existsSync(envPath)) {
  const env = readFileSync(envPath, "utf8");
  check("DATABASE_URL documentada", env.includes("DATABASE_URL="), "DATABASE_URL");
  check("DATABASE_SSL documentada", env.includes("DATABASE_SSL="), "DATABASE_SSL");
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Database audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Database audit passed with ${checks.length} checks.`);
