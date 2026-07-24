const DEFAULT_API_URL = "https://api.constriqo.com";
const DEFAULT_APP_URL = "https://app.constriqo.com";

const apiUrl = normalizeBaseUrl(process.env.PRODUCTION_API_URL || process.env.VITE_API_BASE_URL || DEFAULT_API_URL);
const appUrl = normalizeBaseUrl(process.env.PRODUCTION_APP_URL || process.env.APP_BASE_URL || DEFAULT_APP_URL);
const timeoutMs = clampNumber(process.env.PRODUCTION_HEALTH_TIMEOUT_MS, 1000, 30_000, 10_000);
const retryCount = clampNumber(process.env.PRODUCTION_HEALTH_RETRIES, 1, 5, 3);
const retryDelayMs = clampNumber(process.env.PRODUCTION_HEALTH_RETRY_DELAY_MS, 500, 10_000, 2500);

const checks = [];

await checkUrl("API health", `${apiUrl}/health`, { expectStatus: 200, expectJsonStatus: "ok" });
await checkUrl("API ready", `${apiUrl}/ready`, { allowStatus: [200, 503], expectJsonStatus: ["ok", "not-ready"] });
await checkUrl("Frontend app", appUrl, { expectStatus: 200, expectText: "Constriqo" });

for (const item of checks) {
  const prefix = item.ok ? "ok" : "not ok";
  console.log(`${prefix} - ${item.name}${item.details ? ` (${item.details})` : ""}`);
}

const failed = checks.filter((item) => !item.ok);
if (failed.length > 0) {
  console.error(`Production monitor failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("Production monitor passed.");

async function checkUrl(name, url, options) {
  let lastResult = { ok: false, details: "not checked" };
  for (let attempt = 1; attempt <= retryCount; attempt += 1) {
    lastResult = await checkUrlOnce(name, url, options);
    if (lastResult.ok) {
      checks.push({ ...lastResult, details: appendAttempt(lastResult.details, attempt) });
      return;
    }
    if (attempt < retryCount) {
      await delay(retryDelayMs);
    }
  }
  checks.push({ ...lastResult, details: appendAttempt(lastResult.details, retryCount) });
}

async function checkUrlOnce(name, url, options) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { signal: controller.signal, headers: { accept: "application/json,text/html" } });
    clearTimeout(timeout);

    const statusOk = options.allowStatus ? options.allowStatus.includes(response.status) : response.status === options.expectStatus;
    if (!statusOk) {
      return { name, ok: false, details: `status ${response.status}` };
    }

    const contentType = response.headers.get("content-type") || "";
    if (options.expectJsonStatus) {
      const body = contentType.includes("application/json") ? await response.json() : {};
      const expected = Array.isArray(options.expectJsonStatus) ? options.expectJsonStatus : [options.expectJsonStatus];
      return { name, ok: expected.includes(body.status), details: `status=${body.status || "missing"}` };
    }

    if (options.expectText) {
      const text = await response.text();
      return { name, ok: text.includes(options.expectText), details: `contains ${options.expectText}` };
    }

    return { name, ok: true, details: url };
  } catch (error) {
    return { name, ok: false, details: String(error.message || error) };
  }
}

function normalizeBaseUrl(value) {
  const text = String(value || "").trim().replace(/\/+$/u, "");
  if (!/^https:\/\/[^\s]+$/u.test(text)) {
    console.error(`Invalid HTTPS URL: ${value}`);
    process.exit(1);
  }
  return text;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function appendAttempt(details, attempt) {
  return `${details}; attempts=${attempt}`;
}
