import { requestJson } from "../../../app/auth/authClient";

export type CrmClientStatus = "lead" | "active" | "on_hold" | "archived";

export type CrmClient = {
  clientId: string;
  name: string;
  status: CrmClientStatus;
  primaryContact: string;
  phone: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmSummary = {
  total: number;
  leads: number;
  active: number;
  on_hold: number;
  archived: number;
};

export type CrmActivity = {
  activityId: string;
  type: "call" | "email" | "meeting" | "site_visit" | "note";
  status: string;
  title: string;
  dueAt: string | null;
  createdAt: string;
};

export type CrmNote = {
  noteId: string;
  body: string;
  createdAt: string;
};

export type CrmClientListResponse = {
  items: CrmClient[];
  total: number;
  limit: number;
  offset: number;
  summary: CrmSummary;
};

export type CrmClientDetailResponse = {
  client: CrmClient;
  activities: CrmActivity[];
  notes: CrmNote[];
  related: {
    estimates: Array<{
      estimateId: string;
      estimateNumber: string;
      status: string;
      totalAmount: number;
      currency: string;
      updatedAt: string;
    }>;
    jobs: Array<{
      jobId: string;
      jobNumber: string;
      title: string;
      status: string;
      updatedAt: string;
    }>;
    invoices: Array<{
      invoiceId: string;
      invoiceNumber: string;
      title: string;
      status: string;
      totalAmount: number;
      balanceAmount: number;
      currency: string;
      createdAt: string;
    }>;
  };
};

export type CrmClientInput = {
  name: string;
  status: CrmClientStatus;
  primaryContact?: string;
  phone?: string;
  email?: string;
};

export async function listCrmClients(token: string): Promise<CrmClientListResponse> {
  return requestJson<CrmClientListResponse>("/api/crm/clients", {
    method: "GET",
    token,
  });
}

export async function createCrmClient(token: string, input: CrmClientInput): Promise<CrmClient> {
  const response = await requestJson<{ client: CrmClient }>("/api/crm/clients", {
    method: "POST",
    token,
    body: input,
  });
  return response.client;
}

export async function updateCrmClient(token: string, clientId: string, input: Partial<CrmClientInput>): Promise<CrmClient> {
  const response = await requestJson<{ client: CrmClient }>(`/api/crm/clients/${clientId}`, {
    method: "PATCH",
    token,
    body: input,
  });
  return response.client;
}

export async function archiveCrmClient(token: string, clientId: string): Promise<CrmClient> {
  const response = await requestJson<{ client: CrmClient }>(`/api/crm/clients/${clientId}`, {
    method: "DELETE",
    token,
  });
  return response.client;
}

export async function getCrmClient(token: string, clientId: string): Promise<CrmClientDetailResponse> {
  return requestJson<CrmClientDetailResponse>(`/api/crm/clients/${clientId}`, {
    method: "GET",
    token,
  });
}

export async function createCrmNote(token: string, clientId: string, body: string): Promise<CrmNote> {
  const response = await requestJson<{ note: CrmNote }>(`/api/crm/clients/${clientId}/notes`, {
    method: "POST",
    token,
    body: { body },
  });
  return response.note;
}

export async function createCrmActivity(token: string, clientId: string, title: string): Promise<CrmActivity> {
  const response = await requestJson<{ activity: CrmActivity }>("/api/crm/activities", {
    method: "POST",
    token,
    body: {
      clientId,
      title,
      type: "note",
    },
  });
  return response.activity;
}
