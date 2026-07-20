import { randomUUID } from "node:crypto";
import net from "node:net";
import { pathToFileURL } from "node:url";
import tls from "node:tls";
import pg from "pg";

const { Pool } = pg;
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_INTERVAL_MS = 15_000;
const DEFAULT_MAX_ATTEMPTS = 5;
const MAX_ERROR_LENGTH = 1200;
const MAX_BODY_LENGTH = 200_000;

export function createEmailWorkerPoolFromEnv(env = process.env) {
  const connectionString = env.EMAIL_WORKER_DATABASE_URL || env.ADMIN_DATABASE_URL || env.MIGRATION_DATABASE_URL || env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }
  return new Pool({
    connectionString,
    ssl: env.DATABASE_SSL === "true" ? { rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : false,
    max: Number(env.EMAIL_WORKER_DB_POOL_MAX || 3),
  });
}

export async function processEmailDeliveryBatch({ pool, env = process.env, workerId = `email-worker-${randomUUID()}`, limit } = {}) {
  if (!pool) {
    throw new Error("Email worker requires EMAIL_WORKER_DATABASE_URL, ADMIN_DATABASE_URL, MIGRATION_DATABASE_URL or DATABASE_URL.");
  }

  const batchLimit = clampInt(limit ?? env.EMAIL_WORKER_BATCH_SIZE, 1, 100, DEFAULT_BATCH_SIZE);
  const maxAttempts = clampInt(env.EMAIL_WORKER_MAX_ATTEMPTS, 1, 20, DEFAULT_MAX_ATTEMPTS);
  const client = await pool.connect();
  const deliveries = [];

  try {
    await client.query("BEGIN");
    const result = await client.query(
      `
        SELECT email_delivery_id, tenant_id, recipient_email, recipient_name, from_email, reply_to_email,
               subject, body_text, body_html, template_key, provider, status, related_entity_type,
               related_entity_id, metadata, attempt_count
        FROM email_deliveries
        WHERE status IN ('queued', 'failed')
          AND next_attempt_at <= now()
          AND attempt_count < $1
          AND (worker_locked_until IS NULL OR worker_locked_until < now())
        ORDER BY next_attempt_at ASC, queued_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      `,
      [maxAttempts, batchLimit],
    );

    for (const row of result.rows) {
      await client.query(
        `
          UPDATE email_deliveries
          SET worker_id = $3,
              worker_locked_until = now() + interval '5 minutes',
              last_attempt_at = now(),
              updated_at = now()
          WHERE tenant_id = $1 AND email_delivery_id = $2
        `,
        [row.tenant_id, row.email_delivery_id, workerId],
      );
      deliveries.push(row);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  const results = [];
  for (const delivery of deliveries) {
    results.push(await processOneDelivery(pool, delivery, { env, workerId, maxAttempts }));
  }

  return {
    workerId,
    processed: results.length,
    sent: results.filter((item) => item.status === "sent").length,
    sandboxed: results.filter((item) => item.status === "sandboxed").length,
    failed: results.filter((item) => item.status === "failed").length,
    queued: results.filter((item) => item.status === "queued").length,
    results,
  };
}

async function processOneDelivery(pool, delivery, { env, workerId, maxAttempts }) {
  try {
    const sent = await deliverEmail(delivery, env);
    const finalStatus = sent.status || "sent";
    await markDeliverySuccess(pool, delivery, {
      status: finalStatus,
      providerMessageId: sent.providerMessageId,
      workerId,
    });
    return { emailDeliveryId: delivery.email_delivery_id, status: finalStatus };
  } catch (error) {
    const nextAttempt = Number(delivery.attempt_count || 0) + 1;
    const finalStatus = nextAttempt >= maxAttempts ? "failed" : "queued";
    const retrySeconds = retryDelaySeconds(nextAttempt);
    await markDeliveryFailure(pool, delivery, {
      status: finalStatus,
      attemptCount: nextAttempt,
      retrySeconds,
      workerId,
      errorMessage: String(error.message || error).slice(0, MAX_ERROR_LENGTH),
    });
    return { emailDeliveryId: delivery.email_delivery_id, status: finalStatus, error: String(error.message || error) };
  }
}

async function deliverEmail(delivery, env) {
  const provider = String(delivery.provider || env.EMAIL_PROVIDER || "sandbox").trim().toLowerCase();
  if (provider === "sandbox") {
    return { status: "sandboxed", providerMessageId: `sandbox:${delivery.email_delivery_id}` };
  }
  if (env.EMAIL_WORKER_DRY_RUN === "true") {
    return { status: "sent", providerMessageId: `dry-run:${delivery.email_delivery_id}` };
  }
  if (provider === "smtp") {
    return sendSmtpEmail(delivery, env);
  }
  throw new Error(`Email provider '${provider}' is queued but not implemented by the worker yet.`);
}

export async function sendSmtpEmail(delivery, env = process.env) {
  const host = requiredEnv(env.SMTP_HOST, "SMTP_HOST");
  const port = clampInt(env.SMTP_PORT, 1, 65535, 587);
  const username = requiredEnv(env.SMTP_USERNAME, "SMTP_USERNAME");
  const password = requiredEnv(env.SMTP_PASSWORD, "SMTP_PASSWORD");
  const secure = env.SMTP_SECURE === "true" || port === 465;
  const fromEmail = requiredEmail(delivery.from_email || env.EMAIL_FROM, "EMAIL_FROM");
  const recipientEmail = requiredEmail(delivery.recipient_email, "recipient_email");

  const smtp = await SmtpSession.connect({ host, port, secure });
  try {
    await smtp.expect([220]);
    await smtp.command(`EHLO ${smtpClientName(env)}`, [250]);
    if (!secure) {
      await smtp.command("STARTTLS", [220]);
      await smtp.upgradeToTls(host);
      await smtp.command(`EHLO ${smtpClientName(env)}`, [250]);
    }
    await smtp.command(`AUTH PLAIN ${Buffer.from(`\0${username}\0${password}`, "utf8").toString("base64")}`, [235]);
    await smtp.command(`MAIL FROM:<${fromEmail}>`, [250]);
    await smtp.command(`RCPT TO:<${recipientEmail}>`, [250, 251]);
    await smtp.command("DATA", [354]);
    await smtp.writeData(createMimeMessage(delivery, { fromEmail, recipientEmail }));
    const accepted = await smtp.expect([250]);
    await smtp.command("QUIT", [221]).catch(() => {});
    return { status: "sent", providerMessageId: parseSmtpMessageId(accepted) || `smtp:${delivery.email_delivery_id}` };
  } finally {
    smtp.close();
  }
}

async function markDeliverySuccess(pool, delivery, { status, providerMessageId, workerId }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [delivery.tenant_id]);
    await client.query(
      `
        UPDATE email_deliveries
        SET status = $3,
            attempt_count = attempt_count + 1,
            sent_at = now(),
            last_attempt_at = now(),
            next_attempt_at = now(),
            provider_message_id = $4,
            error_message = NULL,
            worker_id = $5,
            worker_locked_until = NULL,
            updated_at = now()
        WHERE tenant_id = $1 AND email_delivery_id = $2
      `,
      [delivery.tenant_id, delivery.email_delivery_id, status, providerMessageId || null, workerId],
    );
    await writeWorkerAudit(client, delivery, `email.delivery.${status}`, status === "sandboxed" ? "info" : "success", {
      recipientEmail: delivery.recipient_email,
      templateKey: delivery.template_key,
      provider: delivery.provider,
      providerMessageId: providerMessageId || null,
      workerId,
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function markDeliveryFailure(pool, delivery, { status, attemptCount, retrySeconds, workerId, errorMessage }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [delivery.tenant_id]);
    await client.query(
      `
        UPDATE email_deliveries
        SET status = $3,
            attempt_count = $4,
            last_attempt_at = now(),
            next_attempt_at = now() + ($5 * interval '1 second'),
            error_message = $6,
            worker_id = $7,
            worker_locked_until = NULL,
            updated_at = now()
        WHERE tenant_id = $1 AND email_delivery_id = $2
      `,
      [delivery.tenant_id, delivery.email_delivery_id, status, attemptCount, retrySeconds, errorMessage, workerId],
    );
    await writeWorkerAudit(client, delivery, status === "failed" ? "email.delivery.failed" : "email.delivery.retry_scheduled", status === "failed" ? "danger" : "warning", {
      recipientEmail: delivery.recipient_email,
      templateKey: delivery.template_key,
      provider: delivery.provider,
      attemptCount,
      nextRetrySeconds: status === "failed" ? null : retrySeconds,
      errorMessage,
      workerId,
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function writeWorkerAudit(client, delivery, action, severity, metadata) {
  await client.query(
    `
      INSERT INTO audit_events (tenant_id, actor_user_id, action, module_id, entity_type, entity_id, severity, metadata)
      VALUES ($1, NULL, $2, 'notifications-audit-reports', 'email_delivery', $3, $4, $5::jsonb)
    `,
    [delivery.tenant_id, action, delivery.email_delivery_id, severity, JSON.stringify(metadata || {})],
  );
}

function createMimeMessage(delivery, { fromEmail, recipientEmail }) {
  const subject = encodeHeader(delivery.subject || "ConstructFlow");
  const replyTo = delivery.reply_to_email ? `Reply-To: ${delivery.reply_to_email}\r\n` : "";
  const body = String(delivery.body_text || "").slice(0, MAX_BODY_LENGTH);
  const headers = [
    `From: ${formatAddress(fromEmail)}`,
    `To: ${formatAddress(recipientEmail, delivery.recipient_name)}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${delivery.email_delivery_id}@constructflow.local>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
  ];
  return `${headers.join("\r\n")}\r\n${replyTo}\r\n${dotStuff(body)}\r\n.\r\n`;
}

function dotStuff(body) {
  return body.replace(/\r?\n/gu, "\r\n").replace(/^\./gmu, "..");
}

function encodeHeader(value) {
  const text = String(value || "").replace(/[\r\n]/gu, " ").trim();
  return /^[\x20-\x7E]*$/u.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

function formatAddress(email, name = "") {
  const cleanEmail = requiredEmail(email, "email");
  const cleanName = String(name || "").replace(/["\r\n]/gu, "").trim();
  return cleanName ? `"${cleanName}" <${cleanEmail}>` : `<${cleanEmail}>`;
}

function parseSmtpMessageId(response) {
  const text = String(response || "");
  const match = text.match(/\b(?:id|queued as)\s+<?([a-zA-Z0-9._:-]+)>?/iu);
  return match?.[1] || "";
}

function smtpClientName(env) {
  return String(env.SMTP_CLIENT_NAME || "constructflow.local").replace(/[^a-zA-Z0-9.-]/gu, "") || "constructflow.local";
}

function retryDelaySeconds(attemptCount) {
  return Math.min(3600, Math.max(30, 30 * 2 ** Math.max(0, attemptCount - 1)));
}

function requiredEnv(value, name) {
  const text = String(value || "").trim();
  if (!text) {
    throw new Error(`${name} is required for SMTP email delivery.`);
  }
  return text;
}

function requiredEmail(value, name) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new Error(`${name} must be a valid email address.`);
  }
  return email;
}

function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

class SmtpSession {
  constructor(socket) {
    this.socket = socket;
    this.buffer = "";
    this.waiters = [];
    this.socket.setEncoding("utf8");
    this.socket.on("data", (chunk) => this.onData(chunk));
    this.socket.on("error", (error) => this.rejectAll(error));
    this.socket.on("close", () => this.rejectAll(new Error("SMTP connection closed.")));
  }

  static connect({ host, port, secure }) {
    return new Promise((resolve, reject) => {
      const socket = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
      const onError = (error) => reject(error);
      socket.once("error", onError);
      const eventName = secure ? "secureConnect" : "connect";
      socket.once(eventName, () => {
        socket.off("error", onError);
        resolve(new SmtpSession(socket));
      });
      socket.setTimeout(20_000, () => socket.destroy(new Error("SMTP connection timed out.")));
    });
  }

  async upgradeToTls(host) {
    this.socket.removeAllListeners("data");
    this.socket.removeAllListeners("error");
    this.socket.removeAllListeners("close");
    this.socket = tls.connect({ socket: this.socket, servername: host });
    this.buffer = "";
    this.waiters = [];
    this.socket.setEncoding("utf8");
    this.socket.on("data", (chunk) => this.onData(chunk));
    this.socket.on("error", (error) => this.rejectAll(error));
    this.socket.on("close", () => this.rejectAll(new Error("SMTP connection closed.")));
    await new Promise((resolve, reject) => {
      this.socket.once("secureConnect", resolve);
      this.socket.once("error", reject);
    });
  }

  async command(line, expectedCodes) {
    this.socket.write(`${line}\r\n`);
    return this.expect(expectedCodes);
  }

  async writeData(message) {
    this.socket.write(message);
  }

  expect(expectedCodes) {
    return new Promise((resolve, reject) => {
      this.waiters.push({ expectedCodes, resolve, reject });
      this.flush();
    });
  }

  close() {
    this.socket.end();
  }

  onData(chunk) {
    this.buffer += chunk;
    this.flush();
  }

  flush() {
    if (this.waiters.length === 0) {
      return;
    }
    const response = takeCompleteSmtpResponse(this.buffer);
    if (!response) {
      return;
    }
    this.buffer = response.rest;
    const waiter = this.waiters.shift();
    const code = Number.parseInt(response.text.slice(0, 3), 10);
    if (waiter.expectedCodes.includes(code)) {
      waiter.resolve(response.text);
    } else {
      waiter.reject(new Error(`SMTP returned ${response.text.replace(/\r?\n/gu, " | ")}`));
    }
  }

  rejectAll(error) {
    for (const waiter of this.waiters.splice(0)) {
      waiter.reject(error);
    }
  }
}

function takeCompleteSmtpResponse(buffer) {
  const lines = buffer.split(/\r\n/gu);
  if (!buffer.endsWith("\r\n")) {
    lines.pop();
  }
  if (lines.length === 0) {
    return null;
  }
  const responseLines = [];
  let consumed = 0;
  for (const line of lines) {
    if (!line) {
      consumed += 2;
      continue;
    }
    responseLines.push(line);
    consumed += line.length + 2;
    if (/^\d{3}\s/u.test(line)) {
      return { text: responseLines.join("\n"), rest: buffer.slice(consumed) };
    }
  }
  return null;
}

async function runCli() {
  const pool = createEmailWorkerPoolFromEnv();
  if (!pool) {
    console.error("EMAIL_WORKER_DATABASE_URL, ADMIN_DATABASE_URL, MIGRATION_DATABASE_URL or DATABASE_URL is required.");
    process.exitCode = 1;
    return;
  }

  const once = process.argv.includes("--once");
  const intervalMs = clampInt(process.env.EMAIL_WORKER_INTERVAL_MS, 1000, 300_000, DEFAULT_INTERVAL_MS);
  const workerId = process.env.EMAIL_WORKER_ID || `email-worker-${randomUUID()}`;
  try {
    do {
      const result = await processEmailDeliveryBatch({ pool, workerId });
      console.log(JSON.stringify({ event: "email_worker_batch", ...result }));
      if (once) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } while (true);
  } finally {
    await pool.end().catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
