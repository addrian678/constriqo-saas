export const operationsPolicy = {
  pwa: {
    serviceWorker: "disabled-until-qa",
    offlineWrites: "disabled-until-conflict-policy",
    installPrompt: "prepared-not-active",
  },
  observability: {
    requestId: "required",
    structuredLogs: "required-before-runtime",
    metrics: ["http_latency", "error_rate", "db_latency", "outbox_lag"],
  },
  backups: {
    database: "daily-required-before-production",
    storage: "daily-required-before-production",
    restoreDrill: "required-before-production",
  },
  deployment: {
    environments: ["development", "staging", "production"],
    rollbackPlan: "required-before-production",
  },
} as const;
