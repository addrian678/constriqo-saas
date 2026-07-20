import { requestJson } from "../../../app/auth/authClient";

export type DocumentStatus = "active" | "pending_review" | "expired" | "archived" | "generated";

export type ArchiveDocument = {
  documentId: string;
  title: string;
  documentType: string;
  status: DocumentStatus;
  storageKey: string;
  relatedEntityType: string;
  relatedEntityId: string | null;
  expiresAt: string;
  heavyFileCleanedAt?: string | null;
  heavyFileCleanupBatchId?: string | null;
  heavyFileCleanupCutoffAt?: string | null;
  storageSizeBytes: number;
  createdAt: string;
  updatedAt: string;
};

export type DocumentCleanupStatus = {
  firstUseAt: string;
  lastCleanupCutoffAt: string | null;
  cleanupCutoffAt: string;
  checkedAt: string;
  severity: "none" | "warning" | "danger";
  daysOverdue: number;
  escalationDays: number;
  eligibleCount: number;
  requiresArchiveCount: number;
  items: ArchiveDocument[];
  recommendation: string;
};

export type DocumentInput = {
  title: string;
  documentType: string;
  status?: DocumentStatus;
  storageKey?: string;
  storageSizeBytes?: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
  expiresAt?: string;
};

export async function listArchiveDocuments(token: string): Promise<{ items: ArchiveDocument[]; summary: Record<string, number> }> {
  return requestJson<{ items: ArchiveDocument[]; summary: Record<string, number> }>("/api/documents", {
    method: "GET",
    token,
  });
}

export async function getDocumentArchivePlan(token: string): Promise<{ items: ArchiveDocument[]; summary: Record<string, number> }> {
  return requestJson<{ items: ArchiveDocument[]; summary: Record<string, number> }>("/api/documents/archive-plan", {
    method: "GET",
    token,
  });
}

export async function getDocumentCleanupStatus(token: string): Promise<DocumentCleanupStatus> {
  return requestJson<DocumentCleanupStatus>("/api/documents/cleanup-status", {
    method: "GET",
    token,
  });
}

export async function createArchiveDocument(token: string, input: DocumentInput): Promise<ArchiveDocument> {
  const response = await requestJson<{ document: ArchiveDocument }>("/api/documents", {
    method: "POST",
    token,
    body: input,
  });
  return response.document;
}

export async function markDocumentArchiveCompleted(token: string, input: { documentIds: string[]; note?: string }): Promise<{ batchId: string; items: ArchiveDocument[]; updated: number; summary: Record<string, number> }> {
  return requestJson<{ batchId: string; items: ArchiveDocument[]; updated: number; summary: Record<string, number> }>("/api/documents/archive-complete", {
    method: "POST",
    token,
    body: input,
  });
}

export async function cleanupArchivedHeavyFiles(
  token: string,
  input: {
    email: string;
    password: string;
    totpCode: string;
    confirmExternalArchive: boolean;
    note?: string;
  },
): Promise<{ batchId: string; cutoffAt: string; items: ArchiveDocument[]; updated: number; summary: Record<string, number>; cleanupStatus: DocumentCleanupStatus }> {
  return requestJson<{ batchId: string; cutoffAt: string; items: ArchiveDocument[]; updated: number; summary: Record<string, number>; cleanupStatus: DocumentCleanupStatus }>("/api/documents/cleanup-heavy-files", {
    method: "POST",
    token,
    body: input,
  });
}
