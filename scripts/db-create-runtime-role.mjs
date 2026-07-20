import pg from "pg";

const { Client } = pg;
const adminDatabaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
const appDbUser = process.env.APP_DB_USER || "constriqo_app";
const appDbPassword = process.env.APP_DB_PASSWORD;
const appDbName = process.env.POSTGRES_DB || databaseNameFromUrl(adminDatabaseUrl);

if (!adminDatabaseUrl) {
  console.error("MIGRATION_DATABASE_URL or DATABASE_URL is required.");
  process.exit(1);
}

if (!appDbPassword || appDbPassword.length < 16) {
  console.error("APP_DB_PASSWORD is required and must be at least 16 characters.");
  process.exit(1);
}

const client = new Client({
  connectionString: adminDatabaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : false,
});

try {
  await client.connect();

  const existingRole = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [appDbUser]);
  if (existingRole.rowCount === 0) {
    await client.query(
      `CREATE ROLE ${quoteIdentifier(appDbUser)} LOGIN PASSWORD ${sqlLiteral(appDbPassword)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
    );
  } else {
    await client.query(
      `ALTER ROLE ${quoteIdentifier(appDbUser)} LOGIN PASSWORD ${sqlLiteral(appDbPassword)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
    );
  }

  await client.query(`GRANT CONNECT ON DATABASE ${quoteIdentifier(appDbName)} TO ${quoteIdentifier(appDbUser)}`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${quoteIdentifier(appDbUser)}`);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${quoteIdentifier(appDbUser)}`);
  await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${quoteIdentifier(appDbUser)}`);
  await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${quoteIdentifier(appDbUser)}`);
  await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${quoteIdentifier(appDbUser)}`);
  await revokeAuditMutationPrivileges(client, appDbUser);

  console.log(JSON.stringify({ status: "ok", appDbUser, appDbName }, null, 2));
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}

async function revokeAuditMutationPrivileges(client, appDbUser) {
  const auditTables = ["audit_events", "super_admin_audit_events"];
  for (const table of auditTables) {
    const exists = await client.query("SELECT to_regclass($1) AS table_name", [`public.${table}`]);
    if (exists.rows[0]?.table_name) {
      await client.query(`REVOKE UPDATE, DELETE ON TABLE ${quoteIdentifier(table)} FROM ${quoteIdentifier(appDbUser)}`);
    }
  }
}

function databaseNameFromUrl(value) {
  if (!value) {
    return "constriqo_dev";
  }

  return new URL(value).pathname.replace(/^\//u, "") || "constriqo_dev";
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}
