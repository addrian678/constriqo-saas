import pg from "pg";

const { Client } = pg;
const REQUIRED_MIGRATION = "0055_supabase_readiness_schema_migrations_rls.sql";
const checks = [];

function check(name, passed, details = "", severity = "error") {
  checks.push({ name, passed, details, severity });
}

function hasValue(name) {
  return Boolean(String(process.env[name] || "").trim());
}

function isHttpsUrl(value) {
  return /^https:\/\/[^\s/$.?#].[^\s]*$/iu.test(String(value || "").trim());
}

function isPostgresUrl(value) {
  return /^postgres(?:ql)?:\/\/[^\s]+$/iu.test(String(value || "").trim());
}

function hasAllowedOriginDomains(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .every((item) => /^[a-z0-9.-]+\.[a-z]{2,}$/iu.test(item) && !/^https?:\/\//iu.test(item));
}

function safeRedact(value = "") {
  const text = String(value || "");
  if (!text) {
    return "";
  }
  if (text.length <= 8) {
    return "***";
  }
  return `${text.slice(0, 4)}***${text.slice(-4)}`;
}

check("APP_ENV production/staging definido", ["production", "staging"].includes(process.env.APP_ENV), `APP_ENV=${process.env.APP_ENV || ""}`);
check("APP_BASE_URL usa HTTPS", isHttpsUrl(process.env.APP_BASE_URL), "APP_BASE_URL debe ser https://...");
check("VITE_API_BASE_URL usa HTTPS si esta definido", !hasValue("VITE_API_BASE_URL") || isHttpsUrl(process.env.VITE_API_BASE_URL), "VITE_API_BASE_URL debe ser https://...");
check("APP_ALLOWED_ORIGIN_DOMAINS configurado", hasValue("APP_ALLOWED_ORIGIN_DOMAINS") && hasAllowedOriginDomains(process.env.APP_ALLOWED_ORIGIN_DOMAINS), "Ejemplo: constriqo.com, sin https://");
check("SESSION_TOKEN_PEPPER configurado", hasValue("SESSION_TOKEN_PEPPER") && !String(process.env.SESSION_TOKEN_PEPPER).includes("change-me"), "No usar valor de ejemplo.");
check("AUTH_MFA_ENCRYPTION_KEY configurado", hasValue("AUTH_MFA_ENCRYPTION_KEY") && !String(process.env.AUTH_MFA_ENCRYPTION_KEY).includes("change-me"), "No usar valor de ejemplo.");

check("DATABASE_URL runtime configurada", isPostgresUrl(process.env.DATABASE_URL), "Debe usar runtime role limitado.");
check("MIGRATION_DATABASE_URL o ADMIN_DATABASE_URL configurada", isPostgresUrl(process.env.MIGRATION_DATABASE_URL || process.env.ADMIN_DATABASE_URL), "Necesaria para migraciones/preflight.");
check("DATABASE_URL no parece usuario propietario local", !/constructflow_user:change-me|localhost|127\.0\.0\.1/iu.test(String(process.env.DATABASE_URL || "")), "En staging/produccion usar DB remota y usuario limitado.", "warning");

check("EMAIL_PROVIDER real", hasValue("EMAIL_PROVIDER") && !["sandbox", "not-configured"].includes(String(process.env.EMAIL_PROVIDER).toLowerCase()), "EMAIL_PROVIDER=smtp recomendado al inicio.");
if (String(process.env.EMAIL_PROVIDER || "").toLowerCase() === "smtp") {
  check("SMTP_HOST configurado", hasValue("SMTP_HOST"), "SMTP_HOST");
  check("SMTP_PORT configurado", hasValue("SMTP_PORT"), "SMTP_PORT");
  check("SMTP_USERNAME configurado", hasValue("SMTP_USERNAME"), "SMTP_USERNAME");
  check("SMTP_PASSWORD configurado", hasValue("SMTP_PASSWORD"), "SMTP_PASSWORD");
  check("EMAIL_FROM configurado", /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(String(process.env.EMAIL_FROM || "")), "EMAIL_FROM debe ser remitente verificado.");
}
check("EMAIL_DELIVERY_WORKER_ENABLED activo", process.env.EMAIL_DELIVERY_WORKER_ENABLED === "true", "Debe correr npm run email:worker en backend.");
check("EMAIL_WORKER_DATABASE_URL configurada", isPostgresUrl(process.env.EMAIL_WORKER_DATABASE_URL || process.env.ADMIN_DATABASE_URL || process.env.MIGRATION_DATABASE_URL), "Worker necesita conexion backend.");

check("STORAGE_PROVIDER real", ["supabase-storage", "s3-compatible"].includes(String(process.env.STORAGE_PROVIDER || "").toLowerCase()), "Usar supabase-storage al inicio.");
if (String(process.env.STORAGE_PROVIDER || "").toLowerCase() === "supabase-storage") {
  check("SUPABASE_URL HTTPS", isHttpsUrl(process.env.SUPABASE_URL), "SUPABASE_URL");
  check("SUPABASE_SERVICE_ROLE_KEY configurada", hasValue("SUPABASE_SERVICE_ROLE_KEY"), "Nunca frontend.");
  check("STORAGE_BUCKET_DOCUMENTS configurado", hasValue("STORAGE_BUCKET_DOCUMENTS"), "Bucket privado.");
}
check("EXTERNAL_PROVIDERS_VERIFIED activo", process.env.EXTERNAL_PROVIDERS_VERIFIED === "true", "Activar solo despues de probar email/storage/dominio.");

if (isPostgresUrl(process.env.MIGRATION_DATABASE_URL || process.env.ADMIN_DATABASE_URL)) {
  await checkDatabaseMigration(process.env.MIGRATION_DATABASE_URL || process.env.ADMIN_DATABASE_URL);
} else {
  check("Migracion productiva aplicada", false, "No hay MIGRATION_DATABASE_URL/ADMIN_DATABASE_URL para verificar schema_migrations.");
}

const errors = checks.filter((item) => !item.passed && item.severity === "error");
const warnings = checks.filter((item) => !item.passed && item.severity === "warning");

for (const item of checks) {
  const prefix = item.passed ? "ok" : item.severity === "warning" ? "warn" : "not ok";
  console.log(`${prefix} - ${item.name}${item.details ? ` (${item.details})` : ""}`);
}

console.log(
  JSON.stringify(
    {
      status: errors.length === 0 ? "ready" : "not-ready",
      errors: errors.length,
      warnings: warnings.length,
      requiredMigration: REQUIRED_MIGRATION,
      redacted: {
        appBaseUrl: process.env.APP_BASE_URL || "",
        databaseUrl: safeRedact(process.env.DATABASE_URL),
        emailProvider: process.env.EMAIL_PROVIDER || "",
        storageProvider: process.env.STORAGE_PROVIDER || "",
      },
    },
    null,
    2,
  ),
);

if (errors.length > 0) {
  process.exit(1);
}

process.exit(0);

async function checkDatabaseMigration(connectionString) {
  const client = new Client({
    connectionString,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : false,
  });
  try {
    await client.connect();
    const result = await client.query(
      `
        SELECT version
        FROM schema_migrations
        WHERE version = $1 AND status = 'applied'
        LIMIT 1
      `,
      [REQUIRED_MIGRATION],
    );
    check("Migracion productiva aplicada", result.rowCount === 1, REQUIRED_MIGRATION);
  } catch (error) {
    check("Migracion productiva aplicada", false, String(error.message || error));
  } finally {
    await client.end().catch(() => {});
  }
}
