export const licensePolicy = {
  delivery: {
    preferred: "provider-managed-saas",
    privateContainer: "allowed-with-contract",
    sourceRepositoryDelivery: "prohibited-without-explicit-contract",
  },
  validation: {
    managedInstallations: "infrastructure-access-controlled",
    localSignedLicense: "prepared-not-active",
    licenseServer: "future-option",
    failClosedInProduction: true,
  },
  entitlements: {
    moduleAccess: "required-before-client-controlled-installation",
    perCustomerSecrets: true,
    perCustomerDatabase: true,
  },
  audit: {
    licenseChecks: "required-before-client-controlled-installation",
    licenseChanges: "audit_event_required",
  },
} as const;
