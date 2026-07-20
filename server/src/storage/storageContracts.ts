import type { RequestContext } from "../core/requestContext";

export type StorageObjectStatus = "pending_upload" | "available" | "quarantined" | "revoked" | "deleted";

export type StorageObject = {
  storageObjectId: string;
  tenantId: string;
  bucket: string;
  objectKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256?: string;
  status: StorageObjectStatus;
};

export type CreateStorageObjectInput = {
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

export type SignedUploadRequest = {
  storageObject: StorageObject;
  uploadUrl: string;
  expiresAt: string;
};

export type SignedReadRequest = {
  storageObjectId: string;
  readUrl: string;
  expiresAt: string;
};

export type StorageRepository = {
  createObject(context: RequestContext, input: CreateStorageObjectInput): Promise<StorageObject>;
  markAvailable(context: RequestContext, storageObjectId: string, checksumSha256: string): Promise<StorageObject>;
  revokeObject(context: RequestContext, storageObjectId: string): Promise<void>;
};

export type StorageProvider = {
  createSignedUpload(context: RequestContext, object: StorageObject): Promise<SignedUploadRequest>;
  createSignedRead(context: RequestContext, object: StorageObject): Promise<SignedReadRequest>;
};
