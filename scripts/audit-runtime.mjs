import { createRuntimeAuthServiceFromEnv, createRuntimeServer } from "../server/runtime/server.mjs";
import { runtimeManifest } from "../server/runtime/runtimeManifest.mjs";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";

const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

check("Runtime declara modelo SaaS multi-tenant", runtimeManifest.deploymentModel === "multi-tenant-saas", runtimeManifest.deploymentModel);
check("Runtime declara persistence seguro", ["not-configured", "configured"].includes(runtimeManifest.persistence), runtimeManifest.persistence);
check("Runtime declara modulos", runtimeManifest.modules.length >= 15, String(runtimeManifest.modules.length));
check("Runtime declara rutas API", runtimeManifest.routes.length >= 14, String(runtimeManifest.routes.length));
check("Runtime incluye modulo marketing", runtimeManifest.modules.includes("marketing"), runtimeManifest.modules.join(","));
check("Runtime incluye ruta marketing", runtimeManifest.routes.includes("/api/marketing/campaigns"), runtimeManifest.routes.join(","));

const serverSource = readFileSync("server/runtime/server.mjs", "utf8");
const repositorySources = readdirSync("server/runtime")
  .filter((file) => /^postgres.*Repository\.mjs$/u.test(file))
  .map((file) => readFileSync(`server/runtime/${file}`, "utf8"))
  .join("\n");
check("Runtime usa pool PostgreSQL compartido", serverSource.includes("const sharedPool") && serverSource.includes("createPostgresCrmRepository(sharedPool)") && serverSource.includes("createPostgresInvoiceRepository(sharedPool)"), "sharedPool");
check("Runtime no crea pools tenant por modulo FromEnv", !serverSource.includes("createPostgresCrmRepositoryFromEnv") && !serverSource.includes("createPostgresInvoiceRepositoryFromEnv"), "no FromEnv tenant factories");
check("Runtime readiness valida migracion requerida", serverSource.includes("0055_supabase_readiness_schema_migrations_rls.sql") && serverSource.includes("MIGRATIONS_NOT_READY"), "readiness migration");
check("Runtime errores internos usan mensaje publico", serverSource.includes("publicErrorMessage") && !serverSource.includes("message: error.message ||"), "public errors");
check("Runtime no usa count mas uno para numeracion", !/count\(\*\)::integer\s*\+\s*1/iu.test(repositorySources), "document_sequences required");
check("Runtime define helper de secuencias atomicas", readFileSync("server/runtime/documentSequences.mjs", "utf8").includes("ON CONFLICT (tenant_id, document_type, series, fiscal_year)"), "documentSequences");
check("Runtime aplica rate limit general y login", serverSource.includes("createInMemoryRateLimiter") && serverSource.includes("LOGIN_RATE_LIMIT_MAX_REQUESTS") && serverSource.includes("RATE_LIMITED"), "rate limiter");
check("Runtime sanea x-request-id", serverSource.includes("^[a-zA-Z0-9._:-]{8,96}$") && serverSource.includes("randomUUID()"), "request id sanitization");
check("Runtime readiness valida proveedores productivos", serverSource.includes("validateProviderReadiness") && serverSource.includes("PROVIDERS_NOT_READY") && serverSource.includes("SUPABASE_STORAGE_SECRETS") && serverSource.includes("EMAIL_DELIVERY_WORKER_ENABLED") && serverSource.includes("EXTERNAL_PROVIDERS_VERIFIED"), "provider readiness");
check("Branding publico usa tenantSlug", serverSource.includes('url.searchParams.get("tenantSlug")') && !serverSource.includes('url.searchParams.get("tenantId")'), "tenantSlug branding");

const authRepositorySource = readFileSync("server/runtime/postgresAuthRepository.mjs", "utf8");
check("Auth repo bloquea intentos fallidos recientes", authRepositorySource.includes("getFailedLoginPressure") && authRepositorySource.includes("FAILED_LOGIN_LIMIT"), "failed login pressure");
check("Auth repo acepta codigo publico tenant slug", authRepositorySource.includes("resolveTenantIdentifier") && authRepositorySource.includes("tenant_slug"), "tenant slug login");

const server = createRuntimeServer();
const address = await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", () => resolve(server.address()));
});

async function getJson(path) {
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
  return {
    status: response.status,
    headers: response.headers,
    body: await response.json(),
  };
}

try {
  const health = await getJson("/health");
  check("GET /health responde 200", health.status === 200 && health.body.status === "ok", JSON.stringify(health));
  check("Runtime envia CSP", health.headers.get("content-security-policy")?.includes("default-src 'none'"), "content-security-policy");
  check("Runtime bloquea framing", health.headers.get("x-frame-options") === "DENY", "x-frame-options");
  check("Runtime permite geolocalizacion/camara para app propia", health.headers.get("permissions-policy")?.includes("geolocation=(self)") && health.headers.get("permissions-policy")?.includes("camera=(self)"), "permissions-policy");

  const corsPreflight = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
    method: "OPTIONS",
    headers: {
      origin: "http://127.0.0.1:5173",
      "access-control-request-method": "POST",
    },
  });
  check(
    "Runtime permite CORS local controlado",
    corsPreflight.status === 204 && corsPreflight.headers.get("access-control-allow-origin") === "http://127.0.0.1:5173",
    "CORS",
  );

  const ready = await getJson("/ready");
  check("GET /ready falla cerrado sin DB/probe activa", ready.status === 503 && ready.body.status === "not-ready", JSON.stringify(ready));
  check("GET /ready no expone DATABASE_URL", !JSON.stringify(ready.body).includes("postgresql://"), JSON.stringify(ready));

  const readyServer = createRuntimeServer({
    async readinessProbe() {
      return { requiredMigration: "0055_supabase_readiness_schema_migrations_rls.sql" };
    },
  });
  const readyAddress = await new Promise((resolve) => {
    readyServer.listen(0, "127.0.0.1", () => resolve(readyServer.address()));
  });
  const readyOkResponse = await fetch(`http://127.0.0.1:${readyAddress.port}/ready`);
  const readyOk = await readyOkResponse.json();
  await new Promise((resolve) => readyServer.close(resolve));
  check("GET /ready responde ok con probe real", readyOkResponse.status === 200 && readyOk.status === "ok", JSON.stringify(readyOk));

  const modules = await getJson("/api/modules");
  check("GET /api/modules lista modulos", modules.status === 200 && modules.body.modules.includes("crm"), JSON.stringify(modules));

  const api = await getJson("/api/crm/clients");
  check("APIs funcionales exigen sesion SaaS", api.status === 401 && api.body.code === "AUTH_REQUIRED", JSON.stringify(api));

  const spoofedTenantApi = await fetch(`http://127.0.0.1:${address.port}/api/crm/clients?tenant_id=tenant-demo-canyon`, {
    headers: { authorization: "Bearer test-token" },
  });
  const spoofedTenantBody = await spoofedTenantApi.json();
  check(
    "Runtime rechaza tenant enviado por cliente",
    spoofedTenantApi.status === 400 && spoofedTenantBody.code === "VALIDATION_ERROR",
    JSON.stringify(spoofedTenantBody),
  );

  const authorizedApi = await fetch(`http://127.0.0.1:${address.port}/api/crm/clients`, {
    headers: { authorization: "Bearer test-token" },
  });
  const authorizedApiBody = await authorizedApi.json();
  check(
    "Bearer sin adaptador real no accede a datos",
    authorizedApi.status === 503 && authorizedApiBody.code === "AUTH_ADAPTER_NOT_CONFIGURED",
    JSON.stringify(authorizedApiBody),
  );

  const fakeResolverServer = createRuntimeServer({
    sessionContextResolver: {
      async resolve() {
        return {
          requestId: "audit",
          tenant: { tenantId: "00000000-0000-0000-0000-000000000001", companyName: "Audit tenant" },
          actor: { userId: "audit-user", role: "worker", roles: ["worker"], capabilities: [] },
        };
      },
    },
  });
  const fakeResolverAddress = await new Promise((resolve) => {
    fakeResolverServer.listen(0, "127.0.0.1", () => resolve(fakeResolverServer.address()));
  });
  const forbiddenApi = await fetch(`http://127.0.0.1:${fakeResolverAddress.port}/api/crm/clients`, {
    headers: { authorization: "Bearer valid-shape" },
  });
  const forbiddenApiBody = await forbiddenApi.json();
  await new Promise((resolve) => fakeResolverServer.close(resolve));
  check(
    "Runtime aplica capabilities por ruta",
    forbiddenApi.status === 403 && forbiddenApiBody.code === "FORBIDDEN",
    JSON.stringify(forbiddenApiBody),
  );

  const marketingApi = await getJson("/api/marketing/campaigns");
  check(
    "Marketing API exige sesion SaaS",
    marketingApi.status === 401 && marketingApi.body.code === "AUTH_REQUIRED",
    JSON.stringify(marketingApi),
  );

  const tooLarge = await fetch(`http://127.0.0.1:${address.port}/api/crm/clients`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "x".repeat(1024 * 1024 + 1),
  });
  const tooLargeBody = await tooLarge.json();
  check(
    "Runtime rechaza requests demasiado grandes",
    tooLarge.status === 413 && tooLargeBody.code === "REQUEST_TOO_LARGE",
    JSON.stringify(tooLargeBody),
  );

  const loginWithoutAdapter = await fetch(`http://127.0.0.1:${address.port}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenantId: "00000000-0000-0000-0000-000000000001",
      email: "admin@example.com",
      password: "secret",
    }),
  });
  const loginWithoutAdapterBody = await loginWithoutAdapter.json();
  check(
    "Login sin adaptador real responde 503",
    loginWithoutAdapter.status === 503 && loginWithoutAdapterBody.code === "AUTH_ADAPTER_NOT_CONFIGURED",
    JSON.stringify(loginWithoutAdapterBody),
  );

  const rateLimitedAuthServer = createRuntimeServer({
    rateLimiter: {
      consume(key) {
        return key.startsWith("login:")
          ? { allowed: false, retryAfterSeconds: 42 }
          : { allowed: true, retryAfterSeconds: 0 };
      },
    },
    authService: {
      async login() {
        throw new Error("Rate limiter should run before auth service.");
      },
    },
  });
  const rateLimitedAddress = await new Promise((resolve) => {
    rateLimitedAuthServer.listen(0, "127.0.0.1", () => resolve(rateLimitedAuthServer.address()));
  });
  const rateLimitedLogin = await fetch(`http://127.0.0.1:${rateLimitedAddress.port}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": "unsafe request id with spaces" },
    body: JSON.stringify({
      tenantId: "empresa-prueba",
      email: "audit@example.com",
      password: "secret",
    }),
  });
  const rateLimitedLoginBody = await rateLimitedLogin.json();
  await new Promise((resolve) => rateLimitedAuthServer.close(resolve));
  check(
    "Login aplica rate limit antes del auth adapter",
    rateLimitedLogin.status === 429 && rateLimitedLoginBody.code === "RATE_LIMITED" && /^[0-9a-f-]{36}$/iu.test(rateLimitedLoginBody.requestId),
    JSON.stringify(rateLimitedLoginBody),
  );

  const fakeAuthService = {
    sessionContextResolver: {
      async resolve(input) {
        return {
          requestId: input.requestId,
          tenant: { tenantId: "00000000-0000-0000-0000-000000000001", companyName: "Audit tenant" },
          actor: {
            userId: "00000000-0000-0000-0000-000000000002",
            role: "admin",
            roles: ["admin"],
            capabilities: ["clients.read"],
          },
        };
      },
    },
    async login() {
      return {
        status: 200,
        body: {
          sessionToken: "audit-session-token",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          user: {
            userId: "audit-user",
            email: "audit@example.com",
            displayName: "Audit",
            roles: ["admin"],
            capabilities: ["clients.read"],
          },
          tenant: { tenantId: "00000000-0000-0000-0000-000000000001", companyName: "Audit tenant" },
        },
      };
    },
    async setupTotp() {
      return {
        status: 200,
        body: {
          factorId: "factor-audit",
          secret: "JBSWY3DPEHPK3PXP",
          otpauthUri: "otpauth://totp/constriqo:audit@example.com?secret=JBSWY3DPEHPK3PXP",
        },
      };
    },
    async verifyTotp() {
      return {
        status: 200,
        body: {
          sessionToken: "audit-session-token-after-mfa",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          user: {
            userId: "audit-user",
            email: "audit@example.com",
            displayName: "Audit",
            roles: ["admin"],
            capabilities: ["clients.read"],
          },
          tenant: { tenantId: "00000000-0000-0000-0000-000000000001", companyName: "Audit tenant" },
        },
      };
    },
    async logout() {},
  };
  const authServer = createRuntimeServer({ authService: fakeAuthService });
  const authAddress = await new Promise((resolve) => {
    authServer.listen(0, "127.0.0.1", () => resolve(authServer.address()));
  });
  const loginWithAdapter = await fetch(`http://127.0.0.1:${authAddress.port}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tenantId: "00000000-0000-0000-0000-000000000001",
      email: "audit@example.com",
      password: "secret",
    }),
  });
  const loginWithAdapterBody = await loginWithAdapter.json();
  check(
    "Runtime ejecuta login cuando existe auth adapter",
    loginWithAdapter.status === 200 && loginWithAdapterBody.sessionToken === "audit-session-token",
    JSON.stringify(loginWithAdapterBody),
  );
  const sessionWithAdapter = await fetch(`http://127.0.0.1:${authAddress.port}/api/auth/session`, {
    headers: { authorization: "Bearer audit-session-token" },
  });
  const sessionWithAdapterBody = await sessionWithAdapter.json();
  check(
    "Runtime resuelve sesion desde auth adapter",
    sessionWithAdapter.status === 200 && sessionWithAdapterBody.session.actor.role === "admin",
    JSON.stringify(sessionWithAdapterBody),
  );
  const setupTotp = await fetch(`http://127.0.0.1:${authAddress.port}/api/auth/mfa/totp/setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mfaSetupToken: "setup-token" }),
  });
  const setupTotpBody = await setupTotp.json();
  check(
    "Runtime ejecuta setup TOTP desde auth adapter",
    setupTotp.status === 200 && setupTotpBody.otpauthUri.startsWith("otpauth://totp/"),
    JSON.stringify(setupTotpBody),
  );
  const verifyTotp = await fetch(`http://127.0.0.1:${authAddress.port}/api/auth/mfa/totp/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mfaSetupToken: "setup-token", factorId: "factor-audit", code: "123456" }),
  });
  const verifyTotpBody = await verifyTotp.json();
  check(
    "Runtime ejecuta verificacion TOTP desde auth adapter",
    verifyTotp.status === 200 && verifyTotpBody.sessionToken === "audit-session-token-after-mfa",
    JSON.stringify(verifyTotpBody),
  );
  const logoutWithAdapter = await fetch(`http://127.0.0.1:${authAddress.port}/api/auth/logout`, {
    method: "POST",
    headers: { authorization: "Bearer audit-session-token" },
  });
  const logoutWithAdapterBody = await logoutWithAdapter.json();
  await new Promise((resolve) => authServer.close(resolve));
  check(
    "Runtime ejecuta logout desde auth adapter",
    logoutWithAdapter.status === 200 && logoutWithAdapterBody.status === "revoked",
    JSON.stringify(logoutWithAdapterBody),
  );

  const authServiceWithoutDatabase = createRuntimeAuthServiceFromEnv({});
  check("Auth service no se activa sin DATABASE_URL", authServiceWithoutDatabase === null, "no DATABASE_URL");
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Runtime audit failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Runtime audit passed with ${checks.length} checks.`);
