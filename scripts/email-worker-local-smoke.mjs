import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { processEmailDeliveryBatch } from "../server/runtime/emailWorker.mjs";

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL || process.env.MIGRATION_DATABASE_URL;
const checks = [];

function check(name, passed, details = "") {
  checks.push({ name, passed, details });
}

if (!adminDatabaseUrl) {
  console.log("Email worker local smoke skipped: ADMIN_DATABASE_URL or MIGRATION_DATABASE_URL is required.");
  process.exit(0);
}

const pool = new Pool({ connectionString: adminDatabaseUrl, max: 2 });
const tenantId = randomUUID();
const userId = randomUUID();
const deliveryId = randomUUID();
const retryDeliveryId = randomUUID();

try {
  await setupFixtures();
  const result = await processEmailDeliveryBatch({
    pool,
    limit: 5,
    workerId: "smoke-email-worker",
    env: {
      EMAIL_PROVIDER: "sandbox",
      EMAIL_WORKER_MAX_ATTEMPTS: "3",
    },
  });
  check("worker processed queued emails", result.processed >= 2, JSON.stringify(result));

  const delivery = await withTenant(tenantId, (client) =>
    client.query(
      `
        SELECT status, attempt_count, sent_at, provider_message_id, worker_id, error_message
        FROM email_deliveries
        WHERE tenant_id = $1 AND email_delivery_id = $2
      `,
      [tenantId, deliveryId],
    ),
  );
  const row = delivery.rows[0];
  check("email delivery sandboxed by worker", row?.status === "sandboxed", JSON.stringify(row));
  check("email delivery increments attempts", Number(row?.attempt_count || 0) === 1, JSON.stringify(row));
  check("email delivery keeps provider message id", String(row?.provider_message_id || "").startsWith("sandbox:"), JSON.stringify(row));
  check("email delivery clears error", !row?.error_message, JSON.stringify(row));

  const retryDelivery = await withTenant(tenantId, (client) =>
    client.query(
      `
        SELECT status, attempt_count, next_attempt_at, error_message
        FROM email_deliveries
        WHERE tenant_id = $1 AND email_delivery_id = $2
      `,
      [tenantId, retryDeliveryId],
    ),
  );
  const retryRow = retryDelivery.rows[0];
  check("email worker schedules retry after provider error", retryRow?.status === "queued" && Number(retryRow?.attempt_count || 0) === 1, JSON.stringify(retryRow));
  check("email worker stores provider error safely", String(retryRow?.error_message || "").includes("not implemented"), JSON.stringify(retryRow));

  const audit = await withTenant(tenantId, (client) =>
    client.query(
      `
        SELECT action, severity, metadata
        FROM audit_events
        WHERE tenant_id = $1
          AND entity_type = 'email_delivery'
          AND entity_id = $2
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [tenantId, deliveryId],
    ),
  );
  check("email worker writes tenant audit", audit.rows[0]?.action === "email.delivery.sandboxed", JSON.stringify(audit.rows[0]));

  const retryAudit = await withTenant(tenantId, (client) =>
    client.query(
      `
        SELECT action, severity
        FROM audit_events
        WHERE tenant_id = $1
          AND entity_type = 'email_delivery'
          AND entity_id = $2
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [tenantId, retryDeliveryId],
    ),
  );
  check("email worker audits retry", retryAudit.rows[0]?.action === "email.delivery.retry_scheduled" && retryAudit.rows[0]?.severity === "warning", JSON.stringify(retryAudit.rows[0]));

  const failures = checks.filter((item) => !item.passed);
  if (failures.length > 0) {
    console.error(`Email worker local smoke failed with ${failures.length} issue(s).`);
    for (const item of failures) {
      console.error(`not ok - ${item.name}${item.details ? ` (${item.details})` : ""}`);
    }
    process.exit(1);
  }

  for (const item of checks) {
    console.log(`ok - ${item.name}`);
  }
  console.log("Email worker local smoke passed.");
} finally {
  await pool.end().catch(() => {});
}

async function setupFixtures() {
  await withTenant(tenantId, async (client) => {
    await client.query(
      "INSERT INTO tenants (tenant_id, name, industry_profile, locale, currency, timezone) VALUES ($1, 'Smoke Email Worker', 'construction', 'es-US', 'USD', 'America/Denver')",
      [tenantId],
    );
    await client.query(
      "INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, 'email-worker-smoke@local.test', 'Email Worker Smoke', 'active')",
      [userId, tenantId],
    );
    await client.query(
      `
        INSERT INTO email_deliveries (
          email_delivery_id, tenant_id, recipient_email, recipient_name, from_email, subject,
          body_text, template_key, provider, status, related_entity_type, metadata,
          queued_by_user_id, next_attempt_at
        )
        VALUES ($1, $2, 'recipient@example.com', 'Recipient', 'no-reply@constriqo.local',
                'Smoke worker email', 'Mensaje local de prueba', 'worker.smoke',
                'sandbox', 'queued', 'smoke', '{}'::jsonb, $3, now() - interval '1 minute')
      `,
      [deliveryId, tenantId, userId],
    );
    await client.query(
      `
        INSERT INTO email_deliveries (
          email_delivery_id, tenant_id, recipient_email, recipient_name, from_email, subject,
          body_text, template_key, provider, status, related_entity_type, metadata,
          queued_by_user_id, next_attempt_at
        )
        VALUES ($1, $2, 'retry@example.com', 'Retry', 'no-reply@constriqo.local',
                'Smoke retry email', 'Mensaje local de reintento', 'worker.retry',
                'provider_without_worker', 'queued', 'smoke', '{}'::jsonb, $3, now() - interval '1 minute')
      `,
      [retryDeliveryId, tenantId, userId],
    );
  });
}

async function withTenant(currentTenantId, callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [currentTenantId]);
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
