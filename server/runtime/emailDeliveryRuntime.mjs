const EMAIL_PROVIDERS = new Set(["sandbox", "smtp", "resend", "sendgrid", "postmark", "ses"]);

export function resolveEmailDeliveryConfig(env = process.env) {
  const provider = String(env.EMAIL_PROVIDER || "sandbox").trim().toLowerCase();
  const normalizedProvider = EMAIL_PROVIDERS.has(provider) ? provider : "sandbox";
  const isSandbox = normalizedProvider === "sandbox";
  return {
    provider: normalizedProvider,
    status: isSandbox ? "sandboxed" : "queued",
    fromEmail: isSandbox ? "no-reply@constriqo.local" : requiredEmail(env.EMAIL_FROM, "EMAIL_FROM"),
    replyToEmail: isSandbox ? null : optionalEmail(env.EMAIL_REPLY_TO),
    sentAtSql: isSandbox ? "now()" : "NULL",
    mode: isSandbox ? "sandbox" : "transactional",
  };
}

export function createEmailMetadata(inputMetadata = {}, env = process.env) {
  const config = resolveEmailDeliveryConfig(env);
  return {
    ...inputMetadata,
    mode: config.mode,
    provider: config.provider,
    deliveryWorkerRequired: config.status === "queued",
  };
}

function requiredEmail(value, name) {
  const email = optionalEmail(value);
  if (!email) {
    const error = new Error(`${name} is required when EMAIL_PROVIDER is not sandbox.`);
    error.status = 503;
    error.code = "EMAIL_PROVIDER_NOT_READY";
    throw error;
  }
  return email;
}

function optionalEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (!email) {
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    const error = new Error("Email provider address is not valid.");
    error.status = 503;
    error.code = "EMAIL_PROVIDER_NOT_READY";
    throw error;
  }
  return email;
}
