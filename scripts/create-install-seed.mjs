import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=")];
  }),
);

const company = args.get("company");
const email = args.get("admin-email");
const adminName = args.get("admin-name") || "Initial Admin";

if (!company || !email) {
  console.error("Usage: node scripts/create-install-seed.mjs --company=\"Company Name\" --admin-email=admin@example.com [--admin-name=\"Admin Name\"]");
  process.exit(1);
}

const values = {
  TENANT_ID: randomUUID(),
  ADMIN_USER_ID: randomUUID(),
  COMPANY_NAME: company,
  ADMIN_EMAIL: email,
  ADMIN_NAME: adminName,
  INDUSTRY_PROFILE: args.get("industry") || "construction",
  LOCALE: args.get("locale") || "es-US",
  CURRENCY: args.get("currency") || "USD",
  TIMEZONE: args.get("timezone") || "America/Denver",
};

const template = readFileSync(join(root, "database/seeds/install_seed_template.sql"), "utf8");
const sql = Object.entries(values).reduce((current, [key, value]) => {
  return current.replaceAll(`{{${key}}}`, String(value).replaceAll("'", "''"));
}, template);

mkdirSync(join(root, "tmp", "install-seeds"), { recursive: true });
const outputPath = join(root, "tmp", "install-seeds", `install-${values.TENANT_ID}.sql`);
writeFileSync(outputPath, sql);

console.log(outputPath);
