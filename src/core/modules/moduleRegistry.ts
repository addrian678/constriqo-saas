import type { ModuleManifest } from "../contracts/moduleManifest";
import { assetsModuleManifest } from "../../modules/assets/moduleManifest";
import { attendanceModuleManifest } from "../../modules/attendance/moduleManifest";
import { crmModuleManifest } from "../../modules/crm/moduleManifest";
import { dashboardModuleManifest } from "../../modules/dashboard/moduleManifest";
import { documentsModuleManifest } from "../../modules/documents/moduleManifest";
import { estimatesModuleManifest } from "../../modules/estimates/moduleManifest";
import { expensesModuleManifest } from "../../modules/expenses/moduleManifest";
import { financeModuleManifest } from "../../modules/finance/moduleManifest";
import { industryValidationModuleManifest } from "../../modules/industry-validation/moduleManifest";
import { invoicingModuleManifest } from "../../modules/invoicing/moduleManifest";
import { jobsModuleManifest } from "../../modules/jobs/moduleManifest";
import { marketingModuleManifest } from "../../modules/marketing/moduleManifest";
import { notificationsModuleManifest } from "../../modules/notifications/moduleManifest";
import { organizationModuleManifest } from "../../modules/organization/moduleManifest";
import { workforceModuleManifest } from "../../modules/workforce/moduleManifest";
import { workProofsModuleManifest } from "../../modules/work-proofs/moduleManifest";

export const moduleRegistry: ModuleManifest[] = [
  dashboardModuleManifest,
  crmModuleManifest,
  estimatesModuleManifest,
  jobsModuleManifest,
  workforceModuleManifest,
  attendanceModuleManifest,
  workProofsModuleManifest,
  documentsModuleManifest,
  invoicingModuleManifest,
  expensesModuleManifest,
  financeModuleManifest,
  assetsModuleManifest,
  marketingModuleManifest,
  notificationsModuleManifest,
  organizationModuleManifest,
  industryValidationModuleManifest,
];

export const moduleRegistryById = new Map(moduleRegistry.map((manifest) => [manifest.id, manifest]));
