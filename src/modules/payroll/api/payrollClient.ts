import { requestJson } from "../../../app/auth/authClient";

export type PayrollWorker = {
  workerId: string;
  userId?: string | null;
  name: string;
  email: string;
  trade: string;
  status: string;
  payType: "hourly" | "daily";
  hourlyRate: number;
  dailyRate: number;
  paymentFrequency: "daily" | "weekly" | "biweekly" | "monthly";
  currency: "USD" | "COP" | "EUR";
  pendingEntries: number;
  pendingGrossSeconds: number;
  pendingBreakSeconds: number;
  pendingPayableSeconds: number;
  pendingHours: number;
  pendingDays: number;
  pendingAmount: number;
};

export type PayrollPayment = {
  payrollPaymentId: string;
  workerId: string;
  workerName: string;
  periodStart: string;
  periodEnd: string;
  payableSeconds: number;
  payableHours: number;
  paidDays: number;
  payType: "hourly" | "daily";
  rateAmount: number;
  amount: number;
  currency: "USD" | "COP" | "EUR";
  status: string;
  paidAt: string;
  financeTransactionId?: string | null;
  notes: string;
};

export type PayrollSummary = {
  workers: number;
  pendingWorkers: number;
  pendingPayableSeconds: number;
  pendingHours: number;
  pendingAmount: number;
  currency: string;
};

export async function listPayrollWorkers(token: string, filters: { periodStart?: string; periodEnd?: string } = {}) {
  const query = new URLSearchParams();
  if (filters.periodStart) {
    query.set("periodStart", filters.periodStart);
  }
  if (filters.periodEnd) {
    query.set("periodEnd", filters.periodEnd);
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return requestJson<{ items: PayrollWorker[]; payments: PayrollPayment[]; summary: PayrollSummary }>(`/api/payroll/workers${suffix}`, {
    method: "GET",
    token,
  });
}

export async function updatePayrollWorkerSettings(
  token: string,
  workerId: string,
  input: Pick<PayrollWorker, "payType" | "hourlyRate" | "dailyRate" | "paymentFrequency" | "currency">,
) {
  const response = await requestJson<{ settings: Pick<PayrollWorker, "payType" | "hourlyRate" | "dailyRate" | "paymentFrequency" | "currency"> }>(
    `/api/payroll/workers/${workerId}/settings`,
    {
      method: "PATCH",
      token,
      body: input,
    },
  );
  return response.settings;
}

export async function createPayrollPayment(token: string, workerId: string, input: { periodStart: string; periodEnd: string; notes?: string }) {
  const response = await requestJson<{ payment: PayrollPayment }>(`/api/payroll/workers/${workerId}/payments`, {
    method: "POST",
    token,
    body: input,
  });
  return response.payment;
}
