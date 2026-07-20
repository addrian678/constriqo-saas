import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import argon2 from "argon2";
import { createRuntimeServer } from "../server/runtime/server.mjs";
import { encryptSecret, generateCurrentTotpCode } from "../server/runtime/cryptoAuth.mjs";
import { createPostgresDocumentsRepositoryFromEnv } from "../server/runtime/postgresDocumentsRepository.mjs";

process.env.AUTH_MFA_ENCRYPTION_KEY = process.env.AUTH_MFA_ENCRYPTION_KEY || "documents-local-smoke-mfa-key";
process.env.SESSION_TOKEN_PEPPER = process.env.SESSION_TOKEN_PEPPER || "documents-local-smoke-session-pepper";

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

if (!adminDatabaseUrl || !runtimeDatabaseUrl) {
  console.log("Documents local smoke skipped: ADMIN_DATABASE_URL and RUNTIME_DATABASE_URL are required.");
  process.exit(0);
}

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const documentA = randomUUID();
const documentB = randomUUID();
const passwordA = "DocumentsSmoke#2026";
const totpSecretA = "JBSWY3DPEHPK3PXP";
const adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 2 });
const documentsRepository = createPostgresDocumentsRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
let server;
let address;

async function withTenantAdmin(tenantId, callback) {
  const client = await adminPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function setupFixtures() {
  const passwordHashA = await argon2.hash(passwordA);
  const encryptedTotpA = encryptSecret(totpSecretA);
  await adminPool.query(
    `
      INSERT INTO tenants (tenant_id, name, industry_profile, locale, currency, timezone)
      VALUES
        ($1, 'Documents Tenant A', 'construction', 'es-US', 'USD', 'America/Denver'),
        ($2, 'Documents Tenant B', 'construction', 'es-US', 'USD', 'America/Denver')
    `,
    [tenantA, tenantB],
  );
  await withTenantAdmin(tenantA, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'docs-a@local.test', 'Docs A', 'active')", [userA, tenantA]);
    await client.query(
      "INSERT INTO auth_password_credentials (tenant_id, user_id, password_hash) VALUES ($1, $2, $3)",
      [tenantA, userA, passwordHashA],
    );
    await client.query(
      `
        INSERT INTO auth_mfa_factors (tenant_id, user_id, factor_type, label, secret_ciphertext, secret_iv, secret_tag, status, verified_at)
        VALUES ($1, $2, 'totp', 'Smoke TOTP', $3, $4, $5, 'enabled', now() - interval '7 months')
      `,
      [tenantA, userA, encryptedTotpA.ciphertext, encryptedTotpA.iv, encryptedTotpA.tag],
    );
    await client.query(
      `
        INSERT INTO auth_sessions (tenant_id, user_id, session_token_hash, status, expires_at, created_at)
        VALUES ($1, $2, $3, 'revoked', now() - interval '6 months', now() - interval '7 months')
      `,
      [tenantA, userA, `documents-smoke-${tenantA}`],
    );
    await client.query(
      `
        INSERT INTO documents (document_id, tenant_id, title, document_type, status, storage_key, related_entity_type, related_entity_id, created_at, updated_at)
        VALUES ($1, $2, 'Factura antigua', 'invoice_pdf', 'generated', 'generated://invoice/a.pdf', 'invoice', $3, now() - interval '7 months', now() - interval '7 months')
      `,
      [documentA, tenantA, randomUUID()],
    );
  });
  await withTenantAdmin(tenantB, async (client) => {
    await client.query("INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'docs-b@local.test', 'Docs B', 'active')", [userB, tenantB]);
    await client.query(
      `
        INSERT INTO auth_sessions (tenant_id, user_id, session_token_hash, status, expires_at, created_at)
        VALUES ($1, $2, $3, 'revoked', now() - interval '6 months', now() - interval '7 months')
      `,
      [tenantB, userB, `documents-smoke-${tenantB}`],
    );
    await client.query(
      `
        INSERT INTO documents (document_id, tenant_id, title, document_type, status, storage_key, related_entity_type, related_entity_id, created_at, updated_at)
        VALUES ($1, $2, 'Factura B antigua', 'invoice_pdf', 'generated', 'generated://invoice/b.pdf', 'invoice', $3, now() - interval '7 months', now() - interval '7 months')
      `,
      [documentB, tenantB, randomUUID()],
    );
  });
}

function contextForToken(token) {
  const isB = token === "tenant-b";
  return {
    tenant: { tenantId: isB ? tenantB : tenantA, companyName: isB ? "Documents Tenant B" : "Documents Tenant A" },
    actor: {
      userId: isB ? userB : userA,
      role: "admin",
      roles: ["admin"],
      capabilities: ["documents.read", "documents.create", "documents.update", "documents.archive", "documents.cleanup"],
    },
  };
}

async function request(token, path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return {
    status: response.status,
    body: await response.json(),
  };
}

try {
  await setupFixtures();
  server = createRuntimeServer({
    documentsRepository,
    sessionContextResolver: {
      async resolve(input) {
        const token = String(input.authorizationHeader || "").replace(/^Bearer\s+/u, "");
        return contextForToken(token);
      },
    },
  });
  address = await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address()));
  });

  const planA = await request("tenant-a", "/api/documents/archive-plan");
  check("Tenant A ve plan", planA.status === 200 && planA.body.items.some((item) => item.documentId === documentA), JSON.stringify(planA.body));
  check("Tenant B no ve plan A", !(await request("tenant-b", "/api/documents/archive-plan")).body.items.some((item) => item.documentId === documentA), "tenant isolation");

  const complete = await request("tenant-a", "/api/documents/archive-complete", {
    method: "POST",
    body: { documentIds: [documentA], note: "Descargado en carpeta local smoke." },
  });
  check("Tenant A confirma archivo", complete.status === 200 && complete.body.updated === 1, JSON.stringify(complete.body));

  const afterPlanA = await request("tenant-a", "/api/documents/archive-plan");
  check("Documento archivado sale del plan", afterPlanA.status === 200 && !afterPlanA.body.items.some((item) => item.documentId === documentA), JSON.stringify(afterPlanA.body));

  const cleanupStatus = await request("tenant-a", "/api/documents/cleanup-status");
  check("Tenant A ve limpieza pendiente", cleanupStatus.status === 200 && cleanupStatus.body.eligibleCount >= 1, JSON.stringify(cleanupStatus.body));

  const cleanupWithoutMfa = await request("tenant-a", "/api/documents/cleanup-heavy-files", {
    method: "POST",
    body: {
      email: "docs-a@local.test",
      password: passwordA,
      totpCode: "000000",
      confirmExternalArchive: true,
      note: "Intento invalido",
    },
  });
  check("Limpieza rechaza MFA incorrecto", cleanupWithoutMfa.status === 401, JSON.stringify(cleanupWithoutMfa.body));

  const cleanup = await request("tenant-a", "/api/documents/cleanup-heavy-files", {
    method: "POST",
    body: {
      email: "docs-a@local.test",
      password: passwordA,
      totpCode: generateCurrentTotpCode(totpSecretA),
      confirmExternalArchive: true,
      note: "Copia guardada en disco externo local smoke.",
    },
  });
  check("Tenant A limpia archivo pesado", cleanup.status === 200 && cleanup.body.updated === 1, JSON.stringify(cleanup.body));

  const cleanedDocument = await withTenantAdmin(tenantA, async (client) =>
    client.query("SELECT storage_key, heavy_file_original_storage_key, heavy_file_cleaned_at FROM documents WHERE document_id = $1", [documentA]),
  );
  check(
    "Limpieza conserva metadata y quita storage",
    cleanedDocument.rows[0]?.storage_key === null && Boolean(cleanedDocument.rows[0]?.heavy_file_original_storage_key) && Boolean(cleanedDocument.rows[0]?.heavy_file_cleaned_at),
    JSON.stringify(cleanedDocument.rows[0]),
  );

  const crossTenant = await request("tenant-b", "/api/documents/archive-complete", {
    method: "POST",
    body: { documentIds: [documentA], note: "Intento cruzado" },
  });
  check("Tenant B no archiva documento A", crossTenant.status === 400, JSON.stringify(crossTenant.body));

  await withTenantAdmin(tenantA, async (client) => {
    await client.query(
      `
        INSERT INTO tenant_usage_limits (tenant_id, storage_quota_mb, document_quota, updated_by_user_id)
        VALUES ($1, 1, 5000, $2)
        ON CONFLICT (tenant_id) DO UPDATE
        SET storage_quota_mb = 1,
            document_quota = 5000,
            updated_by_user_id = EXCLUDED.updated_by_user_id,
            updated_at = now()
      `,
      [tenantA, userA],
    );
  });
  const quotaBlocked = await request("tenant-a", "/api/documents", {
    method: "POST",
    body: {
      title: "PDF muy pesado",
      documentType: "invoice_pdf",
      status: "generated",
      storageKey: "generated://invoice/too-heavy.pdf",
      storageSizeBytes: 2 * 1024 * 1024,
    },
  });
  check("Tenant A bloquea documento por cuota", quotaBlocked.status === 402 && quotaBlocked.body.code === "TENANT_STORAGE_LIMIT_REACHED", JSON.stringify(quotaBlocked.body));
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await documentsRepository?.close?.();
  for (const tenantId of [tenantA, tenantB]) {
    await withTenantAdmin(tenantId, async (client) => {
      await client.query("DELETE FROM notification_queue WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM tenant_usage_limits WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM documents WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
    }).catch(() => {});
  }
  await adminPool.query("DELETE FROM tenants WHERE tenant_id = ANY($1::uuid[])", [[tenantA, tenantB]]).catch(() => {});
  await adminPool.end();
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Documents local smoke failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Documents local smoke passed with ${checks.length} checks.`);
