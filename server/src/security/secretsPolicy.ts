export const secretsPolicy = {
  storage: {
    environmentOnly: true,
    frontendSecretsAllowed: false,
    commitSecretsAllowed: false,
    perCustomerSecrets: true,
  },
  rotation: {
    required: true,
    onStaffChange: true,
    onIncident: true,
    scheduledDays: 90,
  },
  logging: {
    redactDatabaseUrls: true,
    redactApiKeys: true,
    redactTokens: true,
  },
  integrations: {
    oauthTokensEncryptedAtRest: "required-before-integration",
    providerKeysInEnvOnly: true,
  },
} as const;
