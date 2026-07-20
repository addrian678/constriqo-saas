import { requestJson } from "../../../app/auth/authClient";

export type ReportsSummary = {
  currency: "USD" | "COP" | "EUR";
  generatedAt: string;
  financial: {
    income: number;
    expenses: number;
    netProfit: number;
    receivables: number;
    payables: number;
    assets: number;
    liabilities: number;
    equity: number;
  };
  operations: {
    clients: number;
    openJobs: number;
    activeWorkers: number;
    tasks: number;
    completedTasks: number;
  };
  attendance: {
    entriesMonth: number;
    openEntries: number;
    hoursMonth: number;
  };
  marketing: {
    campaigns: number;
    leads: number;
    convertedLeads: number;
    activeLoyaltyCards: number;
    readyLoyaltyCards: number;
  };
  control: {
    auditEvents30d: number;
    pendingNotifications: number;
    activeDocuments: number;
  };
};

export async function getReportsSummary(token: string): Promise<ReportsSummary> {
  const response = await requestJson<{ report: ReportsSummary }>("/api/reports/summary", {
    method: "GET",
    token,
  });
  return response.report;
}
