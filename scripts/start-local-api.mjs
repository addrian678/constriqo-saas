process.env.DATABASE_URL ||= "postgresql://constructflow_user:change-me@127.0.0.1:5432/constructflow_dev";
process.env.DATABASE_SSL ||= "false";
process.env.APP_ENV ||= "development";
process.env.APP_BASE_URL ||= "http://127.0.0.1:5174";
process.env.PORT ||= "8789";
process.env.HOST ||= "127.0.0.1";
process.env.SESSION_TOKEN_PEPPER ||= "local-dev-session-token-pepper-constructflow";
process.env.AUTH_MFA_ENCRYPTION_KEY ||= "local-dev-mfa-key-constructflow";
process.env.STORAGE_PROVIDER ||= "local-dev";
process.env.LOCAL_STORAGE_ROOT ||= ".local-data/storage";

const { startRuntimeServer } = await import("../server/runtime/server.mjs");

startRuntimeServer();
