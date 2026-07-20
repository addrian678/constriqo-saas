import type { RequestContext } from "../../core/requestContext";
import type { ListResult, RepositoryResult } from "../../persistence/repositoryContracts";
import type { DocumentEntity, DocumentLinkEntity, DocumentVersionEntity } from "./documentDomain";

export type CreateDocumentInput = {
  title: string;
  documentType: string;
  storageObjectId?: string;
  expiresAt?: string;
};

export type DocumentRepository = {
  listDocuments(context: RequestContext): Promise<ListResult<DocumentEntity>>;
  findDocumentById(context: RequestContext, documentId: string): Promise<DocumentEntity | null>;
  createDocument(context: RequestContext, input: CreateDocumentInput): Promise<RepositoryResult<DocumentEntity>>;
  createVersion(context: RequestContext, documentId: string, storageObjectId: string): Promise<RepositoryResult<DocumentVersionEntity>>;
  listLinks(context: RequestContext, documentId: string): Promise<ListResult<DocumentLinkEntity>>;
};
