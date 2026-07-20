import type { IndustryProfileId } from "../../core/contracts/industryProfile";

export const appConfig = {
  brandName: "ConstructFlow",
  activeIndustryProfile: "construction" as IndustryProfileId,
  enabledModules: [
    "dashboard",
    "crm",
    "estimates",
    "jobs",
    "workforce",
    "attendance",
    "work-proofs",
    "documents",
    "invoicing",
    "expenses",
    "finance",
    "assets-liabilities",
    "marketing",
    "notifications-audit-reports",
    "organization",
    "industry-validation",
  ],
  preparedIndustryProfiles: ["cleaning"] as IndustryProfileId[],
  demoMode: {
    enabled: false,
    label: "Acceso real",
    seedData: "disabled",
  },
  companyName: "Canyon Build Services LLC",
  currency: "USD",
  locale: {
    interfaceLanguage: "es-US",
    currency: "USD",
    timezone: "America/Denver",
    documentLanguages: ["es-US", "en-US"],
  },
};
