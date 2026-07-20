import type { AuthenticatedSession } from "../auth/authClient";
import { warmApiCache } from "../auth/authClient";

const warmedSessions = new Set<string>();

const adminPriorityPaths = [
  "/api/finance/dashboard",
  "/api/crm/clients",
  "/api/jobs",
  "/api/workforce/workers",
  "/api/invoicing/invoices",
  "/api/organization/settings",
  "/api/organization/usage",
  "/api/documents/cleanup-status",
];

const adminSecondaryPaths = [
  "/api/estimates",
  "/api/services/prices",
  "/api/attendance/time-entries",
  "/api/expenses",
  "/api/expenses/vendors",
  "/api/assets",
  "/api/liabilities",
  "/api/documents",
  "/api/reports/summary",
  "/api/notifications",
  "/api/marketing/campaigns",
  "/api/marketing/leads",
  "/api/marketing/loyalty-cards",
];

const workerPriorityPaths = [
  "/api/worker/tasks",
  "/api/attendance/me",
  "/api/notifications?role=worker",
  "/api/organization/settings",
];

export function warmTenantWorkspaceCache(session: AuthenticatedSession): void {
  const warmKey = `${session.tenant.tenantId}:${session.user.userId}:${session.sessionToken.slice(0, 16)}`;
  if (warmedSessions.has(warmKey)) {
    return;
  }
  warmedSessions.add(warmKey);

  const isWorkerOnly = session.user.roles.length === 1 && session.user.roles.includes("worker");
  if (isWorkerOnly) {
    void warmApiCache(session.sessionToken, workerPriorityPaths, { concurrency: 2 });
    return;
  }

  const allowedPriority = adminPriorityPaths.filter((path) => canWarmPath(session, path));
  const allowedSecondary = adminSecondaryPaths.filter((path) => canWarmPath(session, path));
  void warmApiCache(session.sessionToken, allowedPriority, { concurrency: 3 }).then(() => {
    const runSecondary = () => void warmApiCache(session.sessionToken, allowedSecondary, { concurrency: 2 });
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(runSecondary, { timeout: 2500 });
    } else {
      globalThis.setTimeout(runSecondary, 700);
    }
  });
}

export function refreshTenantWorkspaceCache(session: AuthenticatedSession): void {
  const isWorkerOnly = session.user.roles.length === 1 && session.user.roles.includes("worker");
  const paths = isWorkerOnly
    ? workerPriorityPaths
    : adminPriorityPaths.filter((path) => canWarmPath(session, path));
  globalThis.setTimeout(() => {
    void warmApiCache(session.sessionToken, paths, { concurrency: isWorkerOnly ? 2 : 3 });
  }, 250);
}

function canWarmPath(session: AuthenticatedSession, path: string) {
  const capabilities = session.user.capabilities;
  if (path.startsWith("/api/finance")) return capabilities.includes("finance.read");
  if (path.startsWith("/api/crm")) return capabilities.includes("clients.read");
  if (path.startsWith("/api/jobs")) return capabilities.includes("jobs.read");
  if (path.startsWith("/api/workforce")) return capabilities.includes("workforce.read");
  if (path.startsWith("/api/invoicing")) return capabilities.includes("invoices.read");
  if (path.startsWith("/api/organization")) return capabilities.includes("organization.read");
  if (path.startsWith("/api/documents")) return capabilities.includes("documents.read");
  if (path.startsWith("/api/estimates")) return capabilities.includes("estimates.read");
  if (path.startsWith("/api/services")) return capabilities.includes("estimates.read");
  if (path.startsWith("/api/attendance")) return capabilities.includes("attendance.read") || capabilities.includes("attendance.review.visual");
  if (path.startsWith("/api/expenses")) return capabilities.includes("expenses.read");
  if (path.startsWith("/api/assets")) return capabilities.includes("assets.read");
  if (path.startsWith("/api/liabilities")) return capabilities.includes("liabilities.read");
  if (path.startsWith("/api/reports")) return capabilities.includes("reports.read");
  if (path.startsWith("/api/notifications")) return capabilities.includes("notifications.read");
  if (path.startsWith("/api/marketing")) return capabilities.includes("marketing.read");
  return true;
}
