import type { RequestContext } from "../../core/requestContext";
import type { ListResult, RepositoryResult } from "../../persistence/repositoryContracts";
import type { ClientEntity, ContactEntity, CrmActivityEntity, CrmNoteEntity } from "./crmDomain";

export type CreateClientInput = {
  name: string;
  status: ClientEntity["status"];
  primaryContact?: string;
  phone?: string;
  email?: string;
};

export type UpdateClientInput = Partial<CreateClientInput>;

export type CreateCrmActivityInput = {
  clientId: string;
  type: CrmActivityEntity["type"];
  title: string;
  dueAt?: string;
  assignedToUserId?: string;
};

export type CreateCrmNoteInput = {
  clientId: string;
  body: string;
};

export type CrmRepository = {
  listClients(context: RequestContext): Promise<ListResult<ClientEntity>>;
  findClientById(context: RequestContext, clientId: string): Promise<ClientEntity | null>;
  createClient(context: RequestContext, input: CreateClientInput): Promise<RepositoryResult<ClientEntity>>;
  updateClient(context: RequestContext, clientId: string, input: UpdateClientInput): Promise<RepositoryResult<ClientEntity>>;
  listContacts(context: RequestContext, clientId: string): Promise<ListResult<ContactEntity>>;
  listActivities(context: RequestContext, clientId: string): Promise<ListResult<CrmActivityEntity>>;
  createActivity(context: RequestContext, input: CreateCrmActivityInput): Promise<RepositoryResult<CrmActivityEntity>>;
  createNote(context: RequestContext, input: CreateCrmNoteInput): Promise<RepositoryResult<CrmNoteEntity>>;
};
