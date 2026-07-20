import { moduleRegistry } from "../../../src/core/modules/moduleRegistry";
import type { BackendModuleContract } from "../core/moduleBackendContract";
import { createReadRoute } from "../core/moduleBackendContract";
import { attendanceApiRoutes } from "./attendance/attendanceRoutes";
import { assetsApiRoutes } from "./assets/assetsRoutes";
import { crmApiRoutes } from "./crm/crmRoutes";
import { documentApiRoutes } from "./documents/documentRoutes";
import { estimateApiRoutes } from "./estimates/estimateRoutes";
import { expenseApiRoutes } from "./expenses/expenseRoutes";
import { financeApiRoutes } from "./finance/financeRoutes";
import { industryApiRoutes } from "./industry-validation/industryRoutes";
import { invoiceApiRoutes } from "./invoicing/invoiceRoutes";
import { jobApiRoutes } from "./jobs/jobRoutes";
import { marketingApiRoutes } from "./marketing/marketingRoutes";
import { organizationApiRoutes } from "./organization/organizationRoutes";
import { workforceApiRoutes } from "./workforce/workforceRoutes";
import { workProofApiRoutes } from "./work-proofs/workProofRoutes";

const readRouteByModuleId: Record<string, string> = {
  dashboard: "/api/dashboard",
  crm: "/api/crm",
  estimates: "/api/estimates",
  jobs: "/api/jobs",
  workforce: "/api/workforce",
  attendance: "/api/attendance",
  "work-proofs": "/api/work-proofs",
  documents: "/api/documents",
  invoicing: "/api/invoicing",
  expenses: "/api/expenses",
  finance: "/api/finance",
  "assets-liabilities": "/api/assets-liabilities",
  "notifications-audit-reports": "/api/notifications",
  organization: "/api/organization",
  "industry-validation": "/api/industry-validation",
};

export const backendModules: BackendModuleContract[] = moduleRegistry.map((manifest) => {
  const readCapability = manifest.capabilities[0] || `${manifest.id}.read`;
  const apiPrefix = readRouteByModuleId[manifest.id] || `/api/${manifest.id}`;
  const routes =
    manifest.id === "crm"
      ? crmApiRoutes
      : manifest.id === "estimates"
        ? estimateApiRoutes
        : manifest.id === "jobs"
          ? jobApiRoutes
          : manifest.id === "workforce"
            ? workforceApiRoutes
            : manifest.id === "attendance"
              ? attendanceApiRoutes
              : manifest.id === "work-proofs"
                ? workProofApiRoutes
                : manifest.id === "documents"
                  ? documentApiRoutes
                  : manifest.id === "invoicing"
                    ? invoiceApiRoutes
                    : manifest.id === "expenses"
                      ? expenseApiRoutes
                      : manifest.id === "finance"
                        ? financeApiRoutes
                        : manifest.id === "assets-liabilities"
                          ? assetsApiRoutes
                          : manifest.id === "marketing"
                            ? marketingApiRoutes
                          : manifest.id === "organization"
                            ? organizationApiRoutes
                            : manifest.id === "industry-validation"
                              ? industryApiRoutes
        : [createReadRoute(manifest.id, apiPrefix, readCapability, `${manifest.id}.list`)];

  return {
    manifest,
    apiPrefix,
    routes,
    persistence: "not-configured",
    audit: "required",
  };
});
