import { createRuntimeAuthServiceFromEnv, createRuntimeServer } from "../server/runtime/server.mjs";
import { generateCurrentTotpCode } from "../server/runtime/cryptoAuth.mjs";

const tenantId = process.env.TEST_TENANT_ID;
const email = process.env.TEST_ADMIN_EMAIL;
const password = process.env.TEST_ADMIN_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD;
const existingTotpSecret = process.env.TEST_TOTP_SECRET;

if (!process.env.DATABASE_URL || !tenantId || !email || !password) {
  console.error("DATABASE_URL, TEST_TENANT_ID, TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD are required.");
  process.exit(1);
}

const authService = createRuntimeAuthServiceFromEnv(process.env);
if (!authService) {
  console.error("Auth service could not be created.");
  process.exit(1);
}

const server = createRuntimeServer({
  authService,
  sessionContextResolver: authService.sessionContextResolver,
});
const address = await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", () => resolve(server.address()));
});
const baseUrl = `http://127.0.0.1:${address.port}`;
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

async function postJson(path, body, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

async function getJson(path, token) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

try {
  const login = await postJson("/api/auth/login", { tenantId, email, password });
  check("Login pide MFA o abre sesion", [200, 202].includes(login.status), JSON.stringify(login.body));

  let sessionToken = login.body.sessionToken;

  if (login.body.code === "MFA_SETUP_REQUIRED") {
    const setup = await postJson("/api/auth/mfa/totp/setup", {
      mfaSetupToken: login.body.mfaSetupToken,
      label: "Local smoke test",
    });
    check("Setup TOTP entrega secreto", setup.status === 200 && setup.body.secret && setup.body.otpauthUri, JSON.stringify(setup.body));

    const secondSetup = await postJson("/api/auth/mfa/totp/setup", {
      mfaSetupToken: login.body.mfaSetupToken,
      label: "Local smoke test",
    });
    check(
      "Setup TOTP es idempotente ante doble click",
      secondSetup.status === 200 && secondSetup.body.factorId === setup.body.factorId && secondSetup.body.secret,
      JSON.stringify(secondSetup.body),
    );

    const code = generateCurrentTotpCode(secondSetup.body.secret);
    const verify = await postJson("/api/auth/mfa/totp/verify", {
      mfaSetupToken: login.body.mfaSetupToken,
      factorId: secondSetup.body.factorId,
      code,
    });
    check("Verify TOTP entrega sesion", verify.status === 200 && verify.body.sessionToken, JSON.stringify(verify.body));
    sessionToken = verify.body.sessionToken;
  } else if (login.body.code === "MFA_REQUIRED") {
    if (!existingTotpSecret) {
      check("MFA existente requiere TEST_TOTP_SECRET", false, "Set TEST_TOTP_SECRET to complete this smoke test.");
    } else {
      const code = generateCurrentTotpCode(existingTotpSecret);
      const verify = await postJson("/api/auth/mfa/totp/verify", {
        mfaChallengeToken: login.body.mfaChallengeToken,
        code,
      });
      check("Verify TOTP existente entrega sesion", verify.status === 200 && verify.body.sessionToken, JSON.stringify(verify.body));
      sessionToken = verify.body.sessionToken;
    }
  }

  const session = await getJson("/api/auth/session", sessionToken);
  check("Session resuelve tenant", session.status === 200 && session.body.session.tenant.tenantId === tenantId, JSON.stringify(session.body));

  const spoofedTenant = await fetch(`${baseUrl}/api/crm/clients?tenant_id=00000000-0000-0000-0000-000000000000`, {
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  const spoofedTenantBody = await spoofedTenant.json();
  check("Runtime rechaza tenant cliente", spoofedTenant.status === 400 && spoofedTenantBody.code === "VALIDATION_ERROR", JSON.stringify(spoofedTenantBody));

  const crm = await getJson("/api/crm/clients", sessionToken);
  check(
    "CRM autenticado pasa auth/capability hasta handler real o repositorio pendiente",
    (crm.status === 501 && crm.body.code === "NOT_IMPLEMENTED") ||
      (crm.status === 503 && crm.body.code === "CRM_REPOSITORY_NOT_CONFIGURED") ||
      (crm.status === 200 && Array.isArray(crm.body.items)),
    JSON.stringify(crm.body),
  );

  const logout = await postJson("/api/auth/logout", {}, sessionToken);
  check("Logout revoca sesion", logout.status === 200 && logout.body.status === "revoked", JSON.stringify(logout.body));
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Auth local smoke failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Auth local smoke passed with ${checks.length} checks.`);
