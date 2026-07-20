import { requestJson } from "../../../app/auth/authClient";

export type WorkerStatus = "active" | "inactive" | "suspended";
export type AvailabilityStatus = "available" | "assigned" | "time_off" | "unavailable";
export type CertificationStatus = "valid" | "expiring" | "expired" | "pending_review";

export type WorkerSummary = {
  workerId: string;
  userId?: string | null;
  userEmail: string;
  name: string;
  status: WorkerStatus;
  trade: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  preferredLanguage: string;
  notes: string;
  activeAssignments: number;
  documentAlerts: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkerAvailability = {
  availabilityId: string;
  date: string;
  status: AvailabilityStatus;
  notes: string;
};

export type WorkerCertification = {
  certificationId: string;
  name: string;
  status: CertificationStatus;
  documentId?: string | null;
  expiresAt?: string;
};

export type WorkerDetailResponse = {
  worker: WorkerSummary;
  availability: WorkerAvailability[];
  certifications: WorkerCertification[];
};

export type WorkerInput = {
  userId?: string | null;
  name: string;
  status?: WorkerStatus;
  trade?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  preferredLanguage?: string;
  notes?: string;
};

export type WorkerUserInput = WorkerInput & {
  workerId?: string | null;
  email: string;
  password?: string;
};

export type WorkerUserResult = {
  user: {
    userId: string;
    email: string;
    displayName: string;
    status: string;
    role: "worker";
  };
  worker: WorkerSummary;
  temporaryPassword: string;
  emailDelivery?: {
    emailDeliveryId: string;
    recipientEmail: string;
    subject: string;
    templateKey: string;
    provider: string;
    status: string;
  };
};

export async function listWorkers(token: string): Promise<{ items: WorkerSummary[]; summary: Record<string, number> }> {
  return requestJson<{ items: WorkerSummary[]; summary: Record<string, number> }>("/api/workforce/workers", {
    method: "GET",
    token,
  });
}

export async function createWorker(token: string, input: WorkerInput): Promise<WorkerSummary> {
  const response = await requestJson<{ worker: WorkerSummary }>("/api/workforce/workers", {
    method: "POST",
    token,
    body: input,
  });
  return response.worker;
}

export async function createWorkerUser(token: string, input: WorkerUserInput): Promise<WorkerUserResult> {
  return requestJson<WorkerUserResult>("/api/workforce/worker-users", {
    method: "POST",
    token,
    body: input,
  });
}

export async function getWorker(token: string, workerId: string): Promise<WorkerDetailResponse> {
  return requestJson<WorkerDetailResponse>(`/api/workforce/workers/${workerId}`, {
    method: "GET",
    token,
  });
}

export async function updateWorker(token: string, workerId: string, input: Partial<WorkerInput>): Promise<WorkerSummary> {
  const response = await requestJson<{ worker: WorkerSummary }>(`/api/workforce/workers/${workerId}`, {
    method: "PATCH",
    token,
    body: input,
  });
  return response.worker;
}
