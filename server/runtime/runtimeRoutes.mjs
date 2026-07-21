export const runtimeApiRoutes = [
  { method: "GET", path: "/api/super-admin/tenants", moduleId: "super-admin", capability: "superadmin.read" },
  { method: "POST", path: "/api/super-admin/tenants", moduleId: "super-admin", capability: "superadmin.manage" },
  { method: "PATCH", path: "/api/super-admin/tenants/:tenantId/license", moduleId: "super-admin", capability: "superadmin.manage" },
  { method: "GET", path: "/api/crm/clients", moduleId: "crm", capability: "clients.read" },
  { method: "POST", path: "/api/crm/clients", moduleId: "crm", capability: "clients.create" },
  { method: "GET", path: "/api/crm/clients/:clientId", moduleId: "crm", capability: "clients.read" },
  { method: "PATCH", path: "/api/crm/clients/:clientId", moduleId: "crm", capability: "clients.update" },
  { method: "DELETE", path: "/api/crm/clients/:clientId", moduleId: "crm", capability: "clients.update" },
  { method: "POST", path: "/api/crm/activities", moduleId: "crm", capability: "clients.update" },
  { method: "POST", path: "/api/crm/clients/:clientId/notes", moduleId: "crm", capability: "clients.update" },
  { method: "GET", path: "/api/estimates", moduleId: "estimates", capability: "estimates.read" },
  { method: "POST", path: "/api/estimates", moduleId: "estimates", capability: "estimates.create" },
  { method: "GET", path: "/api/estimates/:estimateId", moduleId: "estimates", capability: "estimates.read" },
  { method: "GET", path: "/api/estimates/:estimateId/pdf", moduleId: "estimates", capability: "estimates.pdf.download" },
  { method: "POST", path: "/api/estimates/:estimateId/send-email", moduleId: "estimates", capability: "email.deliveries.send" },
  { method: "PATCH", path: "/api/estimates/:estimateId", moduleId: "estimates", capability: "estimates.update" },
  { method: "POST", path: "/api/estimates/:estimateId/versions", moduleId: "estimates", capability: "estimates.update" },
  { method: "POST", path: "/api/estimates/:estimateId/approve", moduleId: "estimates", capability: "estimates.approve" },
  { method: "GET", path: "/api/services/prices", moduleId: "services-prices", capability: "estimates.read" },
  { method: "POST", path: "/api/services/prices", moduleId: "services-prices", capability: "estimates.update" },
  { method: "PATCH", path: "/api/services/prices/:serviceId", moduleId: "services-prices", capability: "estimates.update" },
  { method: "DELETE", path: "/api/services/prices/:serviceId", moduleId: "services-prices", capability: "estimates.update" },
  { method: "GET", path: "/api/jobs", moduleId: "jobs", capability: "jobs.read" },
  { method: "POST", path: "/api/jobs", moduleId: "jobs", capability: "jobs.create" },
  { method: "GET", path: "/api/jobs/:jobId", moduleId: "jobs", capability: "jobs.read" },
  { method: "PATCH", path: "/api/jobs/:jobId", moduleId: "jobs", capability: "jobs.update" },
  { method: "POST", path: "/api/jobs/:jobId/assignments", moduleId: "jobs", capability: "jobs.update" },
  { method: "POST", path: "/api/jobs/:jobId/tasks", moduleId: "jobs", capability: "jobs.update" },
  { method: "PATCH", path: "/api/jobs/:jobId/tasks/:taskId", moduleId: "jobs", capability: "jobs.update" },
  { method: "POST", path: "/api/jobs/:jobId/change-requests", moduleId: "jobs", capability: "jobs.update" },
  { method: "GET", path: "/api/worker/tasks", moduleId: "worker-self", capability: "worker.tasks.read" },
  { method: "PATCH", path: "/api/worker/tasks/:taskId", moduleId: "worker-self", capability: "worker.tasks.update" },
  { method: "GET", path: "/api/workforce/workers", moduleId: "workforce", capability: "workforce.read" },
  { method: "POST", path: "/api/workforce/workers", moduleId: "workforce", capability: "workforce.manage" },
  { method: "POST", path: "/api/workforce/worker-users", moduleId: "workforce", capability: "workforce.manage" },
  { method: "GET", path: "/api/workforce/workers/:workerId", moduleId: "workforce", capability: "workforce.read" },
  { method: "PATCH", path: "/api/workforce/workers/:workerId", moduleId: "workforce", capability: "workforce.manage" },
  { method: "GET", path: "/api/attendance/time-entries", moduleId: "attendance", capability: "attendance.read" },
  { method: "GET", path: "/api/attendance/me", moduleId: "attendance", capability: "attendance.self.visual" },
  { method: "POST", path: "/api/attendance/clock-in", moduleId: "attendance", capability: "attendance.self.visual" },
  { method: "POST", path: "/api/attendance/break-start", moduleId: "attendance", capability: "attendance.self.visual" },
  { method: "POST", path: "/api/attendance/break-end", moduleId: "attendance", capability: "attendance.self.visual" },
  { method: "POST", path: "/api/attendance/clock-out", moduleId: "attendance", capability: "attendance.self.visual" },
  {
    method: "POST",
    path: "/api/attendance/time-entries/:timeEntryId/approve",
    moduleId: "attendance",
    capability: "attendance.review.visual",
  },
  { method: "GET", path: "/api/work-proofs/field-reports", moduleId: "work-proofs", capability: "field-reports.read" },
  { method: "POST", path: "/api/work-proofs/field-reports", moduleId: "work-proofs", capability: "field-reports.create" },
  { method: "POST", path: "/api/work-proofs/proofs", moduleId: "work-proofs", capability: "proofs.self.visual" },
  { method: "GET", path: "/api/documents", moduleId: "documents", capability: "documents.read" },
  { method: "GET", path: "/api/documents/archive-plan", moduleId: "documents", capability: "documents.read" },
  { method: "GET", path: "/api/documents/cleanup-status", moduleId: "documents", capability: "documents.read" },
  { method: "POST", path: "/api/documents/archive-complete", moduleId: "documents", capability: "documents.archive" },
  { method: "POST", path: "/api/documents/cleanup-heavy-files", moduleId: "documents", capability: "documents.cleanup" },
  { method: "POST", path: "/api/documents", moduleId: "documents", capability: "documents.create" },
  { method: "POST", path: "/api/documents/:documentId/versions", moduleId: "documents", capability: "documents.update" },
  { method: "GET", path: "/api/invoicing/invoices", moduleId: "invoicing", capability: "invoices.read" },
  { method: "POST", path: "/api/invoicing/invoices", moduleId: "invoicing", capability: "invoices.create" },
  { method: "GET", path: "/api/invoicing/invoices/:invoiceId", moduleId: "invoicing", capability: "invoices.read" },
  { method: "POST", path: "/api/invoicing/invoices/:invoiceId/issue", moduleId: "invoicing", capability: "invoices.issue" },
  { method: "PATCH", path: "/api/invoicing/invoices/:invoiceId/status", moduleId: "invoicing", capability: "invoices.update" },
  { method: "POST", path: "/api/invoicing/invoices/:invoiceId/payments", moduleId: "invoicing", capability: "payments.record" },
  { method: "GET", path: "/api/invoicing/invoices/:invoiceId/pdf", moduleId: "invoicing", capability: "invoices.pdf.download" },
  { method: "POST", path: "/api/invoicing/invoices/:invoiceId/send-email", moduleId: "invoicing", capability: "email.deliveries.send" },
  {
    method: "GET",
    path: "/api/invoicing/invoices/:invoiceId/payments/:paymentId/receipt.pdf",
    moduleId: "invoicing",
    capability: "invoices.pdf.download",
  },
  { method: "POST", path: "/api/invoicing/invoices/:invoiceId/credit-notes", moduleId: "invoicing", capability: "invoices.credit_notes.create" },
  { method: "POST", path: "/api/invoicing/payments", moduleId: "invoicing", capability: "payments.record" },
  { method: "GET", path: "/api/expenses", moduleId: "expenses", capability: "expenses.read" },
  { method: "POST", path: "/api/expenses", moduleId: "expenses", capability: "expenses.create" },
  { method: "GET", path: "/api/expenses/vendors", moduleId: "expenses", capability: "expenses.read" },
  { method: "POST", path: "/api/expenses/vendors", moduleId: "expenses", capability: "expenses.create" },
  { method: "POST", path: "/api/expenses/:expenseId/approve", moduleId: "expenses", capability: "expenses.approve" },
  { method: "POST", path: "/api/expenses/:expenseId/payments", moduleId: "expenses", capability: "expenses.approve" },
  { method: "GET", path: "/api/finance/dashboard", moduleId: "finance", capability: "finance.read" },
  { method: "GET", path: "/api/finance/accounts", moduleId: "finance", capability: "finance.read" },
  { method: "GET", path: "/api/finance/transactions", moduleId: "finance", capability: "cashflow.read" },
  { method: "POST", path: "/api/finance/transactions", moduleId: "finance", capability: "finance.manage" },
  { method: "POST", path: "/api/finance/transactions/:transactionId/correct", moduleId: "finance", capability: "finance.manage" },
  { method: "GET", path: "/api/assets", moduleId: "assets-liabilities", capability: "assets.read" },
  { method: "POST", path: "/api/assets", moduleId: "assets-liabilities", capability: "assets.manage" },
  { method: "GET", path: "/api/liabilities", moduleId: "assets-liabilities", capability: "liabilities.read" },
  { method: "POST", path: "/api/liabilities", moduleId: "assets-liabilities", capability: "liabilities.manage" },
  { method: "GET", path: "/api/marketing/campaigns", moduleId: "marketing", capability: "marketing.read" },
  { method: "POST", path: "/api/marketing/campaigns", moduleId: "marketing", capability: "marketing.manage" },
  { method: "GET", path: "/api/marketing/leads", moduleId: "marketing", capability: "marketing.read" },
  { method: "POST", path: "/api/marketing/leads", moduleId: "marketing", capability: "marketing.manage" },
  { method: "GET", path: "/api/marketing/loyalty-cards", moduleId: "marketing", capability: "marketing.read" },
  { method: "POST", path: "/api/marketing/loyalty-cards", moduleId: "marketing", capability: "marketing.manage" },
  { method: "PATCH", path: "/api/marketing/loyalty-cards/:loyaltyCardId", moduleId: "marketing", capability: "marketing.manage" },
  {
    method: "POST",
    path: "/api/marketing/leads/:marketingLeadId/convert",
    moduleId: "marketing",
    capability: "marketing.leads.convert",
  },
  { method: "GET", path: "/api/notifications", moduleId: "notifications-audit-reports", capability: "notifications.read" },
  { method: "POST", path: "/api/notifications/read-visible", moduleId: "notifications-audit-reports", capability: "notifications.read" },
  { method: "GET", path: "/api/notifications/preferences", moduleId: "notifications-audit-reports", capability: "notifications.read" },
  { method: "PATCH", path: "/api/notifications/preferences", moduleId: "notifications-audit-reports", capability: "notifications.read" },
  { method: "PATCH", path: "/api/notifications/:notificationId/read", moduleId: "notifications-audit-reports", capability: "notifications.read" },
  { method: "GET", path: "/api/audit-events", moduleId: "notifications-audit-reports", capability: "audit.read" },
  { method: "GET", path: "/api/email/deliveries", moduleId: "notifications-audit-reports", capability: "email.deliveries.read" },
  { method: "GET", path: "/api/reports/summary", moduleId: "reports", capability: "reports.read" },
  { method: "GET", path: "/api/organization/settings", moduleId: "organization", capability: "organization.read" },
  { method: "PATCH", path: "/api/organization/settings", moduleId: "organization", capability: "organization.manage" },
  { method: "PATCH", path: "/api/organization/settings/:key", moduleId: "organization", capability: "organization.manage" },
  { method: "GET", path: "/api/organization/usage", moduleId: "organization", capability: "organization.read" },
  { method: "GET", path: "/api/organization/users", moduleId: "organization", capability: "organization.users.manage" },
  { method: "POST", path: "/api/organization/users", moduleId: "organization", capability: "organization.users.manage" },
  { method: "PATCH", path: "/api/organization/users/:userId", moduleId: "organization", capability: "organization.users.manage" },
  { method: "POST", path: "/api/organization/users/:userId/reset-password", moduleId: "organization", capability: "organization.users.manage" },
  { method: "GET", path: "/api/compliance/policy-acceptances", moduleId: "organization", capability: "organization.read" },
  { method: "POST", path: "/api/compliance/policy-acceptances", moduleId: "organization", capability: "organization.read" },
  { method: "GET", path: "/api/compliance/privacy-preferences", moduleId: "organization", capability: "organization.read" },
  { method: "PATCH", path: "/api/compliance/privacy-preferences", moduleId: "organization", capability: "organization.read" },
  {
    method: "PATCH",
    path: "/api/organization/feature-flags/:moduleId",
    moduleId: "organization",
    capability: "organization.manage",
  },
  { method: "GET", path: "/api/industry/profiles", moduleId: "industry-validation", capability: "industry.validation.read.visual" },
  {
    method: "POST",
    path: "/api/industry/profiles/:profileId/prepare",
    moduleId: "industry-validation",
    capability: "industry.validation.read.visual",
  },
];

function matchPath(pattern, pathname) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return false;
  }

  const params = {};
  const matched = patternParts.every((part, index) => {
    if (part.startsWith(":")) {
      params[part.slice(1)] = pathParts[index];
      return true;
    }

    return part === pathParts[index];
  });

  return matched ? params : null;
}

export function findRuntimeApiRoute(method, pathname) {
  for (const route of runtimeApiRoutes) {
    if (route.method !== method) {
      continue;
    }

    const params = matchPath(route.path, pathname);
    if (params) {
      return { ...route, params };
    }
  }

  return null;
}
