import { createRuntimeServer } from "../server/runtime/server.mjs";

const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

const server = createRuntimeServer();
const address = await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", () => resolve(server.address()));
});

async function getJson(path) {
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
  return {
    status: response.status,
    body: await response.json(),
  };
}

try {
  const health = await getJson("/health");
  check("health ok", health.status === 200 && health.body.status === "ok", JSON.stringify(health));

  const ready = await getJson("/ready");
  check("ready falla cerrado sin base configurada", ready.status === 503 && ready.body.status === "not-ready", JSON.stringify(ready));
  check("ready no expone secretos", !JSON.stringify(ready.body).includes("postgresql://"), JSON.stringify(ready));

  const modules = await getJson("/api/modules");
  check("modules incluye marketing", modules.status === 200 && modules.body.modules.includes("marketing"), JSON.stringify(modules));

  const routes = await getJson("/api/routes");
  check("routes incluye marketing", routes.status === 200 && routes.body.routes.includes("/api/marketing/campaigns"), JSON.stringify(routes));

  const crm = await getJson("/api/crm/clients");
  check("crm endpoint exige sesion", crm.status === 401 && crm.body.code === "AUTH_REQUIRED", JSON.stringify(crm));
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`Smoke test failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`Smoke test passed with ${checks.length} checks.`);
