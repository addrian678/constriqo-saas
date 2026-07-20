export const hardeningPolicy = {
  transport: {
    httpsRequiredInProduction: true,
    secureCookiesInProduction: true,
  },
  access: {
    sshLeastPrivilege: true,
    adminMfaRequiredBeforeProduction: true,
    productionDatabaseDirectAccess: "restricted",
  },
  runtime: {
    securityHeadersRequired: true,
    rateLimitRequiredForPublicForms: true,
    requestSizeLimitRequired: true,
  },
  supplyChain: {
    privateRepository: true,
    dependencyAuditRequired: true,
    ciBuildRequiredBeforeRelease: true,
  },
} as const;
