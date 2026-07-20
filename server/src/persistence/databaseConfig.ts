export type DatabaseConfig = {
  url: string;
  ssl: boolean;
  appEnv: "development" | "test" | "staging" | "production";
};

export type DatabaseEnvironment = {
  DATABASE_URL?: string;
  DATABASE_SSL?: string;
  APP_ENV?: string;
};

export function createDatabaseConfig(env: DatabaseEnvironment): DatabaseConfig {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required before enabling persistence.");
  }

  return {
    url: env.DATABASE_URL,
    ssl: env.DATABASE_SSL === "true",
    appEnv: normalizeAppEnv(env.APP_ENV),
  };
}

function normalizeAppEnv(value: string | undefined): DatabaseConfig["appEnv"] {
  if (value === "test" || value === "staging" || value === "production") {
    return value;
  }

  return "development";
}
