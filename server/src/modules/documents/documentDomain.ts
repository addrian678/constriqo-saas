export type DocumentStatus = "draft" | "active" | "pending_review" | "expired" | "archived";
export type DocumentPermissionLevel = "read" | "write" | "admin";

export type DocumentEntity = {
  documentId: string;
  tenantId: string;
  title: string;
  documentType: string;
  status: DocumentStatus;
  storageObjectId?: string;
  expiresAt?: string;
};

export type DocumentVersionEntity = {
  documentVersionId: string;
  tenantId: string;
  documentId: string;
  versionNumber: number;
  storageObjectId?: string;
};

export type DocumentLinkEntity = {
  documentLinkId: string;
  tenantId: string;
  documentId: string;
  relatedEntityType: string;
  relatedEntityId: string;
};
