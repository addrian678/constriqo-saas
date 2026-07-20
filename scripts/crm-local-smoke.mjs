import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createRuntimeServer } from "../server/runtime/server.mjs";
import { createPostgresCrmRepositoryFromEnv } from "../server/runtime/postgresCrmRepository.mjs";

const adminDatabaseUrl = process.env.ADMIN_DATABASE_URL;
const runtimeDatabaseUrl = process.env.RUNTIME_DATABASE_URL || process.env.DATABASE_URL;
const checks = [];

function check(name, passed, details) {
  checks.push({ name, passed, details });
}

if (!adminDatabaseUrl || !runtimeDatabaseUrl) {
  console.log("CRM local smoke skipped: ADMIN_DATABASE_URL and RUNTIME_DATABASE_URL are required.");
  process.exit(0);
}

const tenantA = randomUUID();
const tenantB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const adminPool = new Pool({ connectionString: adminDatabaseUrl, max: 2 });
const crmRepository = createPostgresCrmRepositoryFromEnv({ DATABASE_URL: runtimeDatabaseUrl });
let server;
let address;
let clientAId;

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
  await adminPool.query(
    `
      INSERT INTO tenants (tenant_id, name, industry_profile, locale, currency, timezone)
      VALUES
        ($1, 'CRM Smoke Tenant A', 'construction', 'es-US', 'USD', 'Europe/Berlin'),
        ($2, 'CRM Smoke Tenant B', 'construction', 'es-US', 'USD', 'Europe/Berlin')
    `,
    [tenantA, tenantB],
  );
  await withTenantAdmin(tenantA, (client) =>
    client.query(
      "INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, $3, $4, 'active')",
      [userA, tenantA, "crm-smoke-a@local.test", "CRM Smoke A"],
    ),
  );
  await withTenantAdmin(tenantB, (client) =>
    client.query(
      "INSERT INTO users (user_id, tenant_id, email, display_name, status) VALUES ($1, $2, $3, $4, 'active')",
      [userB, tenantB, "crm-smoke-b@local.test", "CRM Smoke B"],
    ),
  );
}

function contextForToken(token) {
  const isB = token === "tenant-b";
  const tenantId = isB ? tenantB : tenantA;
  const userId = isB ? userB : userA;
  return {
    tenant: { tenantId, companyName: isB ? "CRM Smoke Tenant B" : "CRM Smoke Tenant A" },
    actor: {
      userId,
      role: "admin",
      roles: ["admin"],
      capabilities: ["clients.read", "clients.create", "clients.update"],
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
    crmRepository,
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

  const create = await request("tenant-a", "/api/crm/clients", {
    method: "POST",
    body: {
      name: "Cliente smoke aislado",
      status: "lead",
      primaryContact: "Contacto A",
      email: "cliente-smoke@example.com",
    },
  });
  clientAId = create.body.client?.clientId;
  check("Tenant A crea cliente CRM", create.status === 201 && Boolean(clientAId), JSON.stringify(create.body));

  const listA = await request("tenant-a", "/api/crm/clients");
  check("Tenant A ve su cliente", listA.status === 200 && listA.body.items.some((client) => client.clientId === clientAId), JSON.stringify(listA.body));

  const listB = await request("tenant-b", "/api/crm/clients");
  check("Tenant B no ve cliente de tenant A", listB.status === 200 && !listB.body.items.some((client) => client.clientId === clientAId), JSON.stringify(listB.body));

  const forbiddenDetail = await request("tenant-b", `/api/crm/clients/${clientAId}`);
  check("Tenant B no puede leer detalle de tenant A", forbiddenDetail.status === 404, JSON.stringify(forbiddenDetail.body));

  const forbiddenNote = await request("tenant-b", `/api/crm/clients/${clientAId}/notes`, {
    method: "POST",
    body: { body: "Intento cruzado" },
  });
  check("Tenant B no puede escribir nota en cliente de tenant A", forbiddenNote.status === 404, JSON.stringify(forbiddenNote.body));

  const update = await request("tenant-a", `/api/crm/clients/${clientAId}`, {
    method: "PATCH",
    body: { status: "active", phone: "+49 000 000" },
  });
  check("Tenant A actualiza cliente", update.status === 200 && update.body.client.status === "active", JSON.stringify(update.body));

  const note = await request("tenant-a", `/api/crm/clients/${clientAId}/notes`, {
    method: "POST",
    body: { body: "Nota temporal de smoke CRM." },
  });
  check("Tenant A crea nota", note.status === 201 && Boolean(note.body.note?.noteId), JSON.stringify(note.body));

  const activity = await request("tenant-a", "/api/crm/activities", {
    method: "POST",
    body: { clientId: clientAId, type: "note", title: "Actividad temporal de smoke" },
  });
  check("Tenant A crea actividad", activity.status === 201 && Boolean(activity.body.activity?.activityId), JSON.stringify(activity.body));

  const archive = await request("tenant-a", `/api/crm/clients/${clientAId}`, {
    method: "DELETE",
  });
  check("Tenant A archiva cliente", archive.status === 200 && archive.body.client.status === "archived", JSON.stringify(archive.body));

  const listAfterArchive = await request("tenant-a", "/api/crm/clients");
  check(
    "Listado principal oculta archivados",
    listAfterArchive.status === 200 && !listAfterArchive.body.items.some((client) => client.clientId === clientAId),
    JSON.stringify(listAfterArchive.body),
  );

  const auditCount = await withTenantAdmin(tenantA, (client) =>
    client.query("SELECT count(*)::integer AS total FROM audit_events WHERE tenant_id = $1 AND module_id = 'crm'", [tenantA]),
  );
  check("Operaciones CRM generan auditoria", auditCount.rows[0].total >= 5, JSON.stringify(auditCount.rows[0]));
} finally {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await crmRepository?.close?.();
  for (const tenantId of [tenantA, tenantB]) {
    await withTenantAdmin(tenantId, async (client) => {
      await client.query("DELETE FROM client_notes WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM client_activities WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM clients WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM audit_events WHERE tenant_id = $1", [tenantId]);
      await client.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
    }).catch(() => {});
  }
  await adminPool.query("DELETE FROM tenants WHERE tenant_id = ANY($1::uuid[])", [[tenantA, tenantB]]).catch(() => {});
  await adminPool.end();
}

const failed = checks.filter((item) => !item.passed);
if (failed.length > 0) {
  console.error(`CRM local smoke failed with ${failed.length} issue(s).`);
  for (const item of failed) {
    console.error(`- ${item.name}: ${item.details}`);
  }
  process.exit(1);
}

console.log(`CRM local smoke passed with ${checks.length} checks.`);
