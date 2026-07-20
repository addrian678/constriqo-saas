export type ClientStatus = "lead" | "active" | "on_hold" | "archived";
export type ActivityType = "call" | "email" | "meeting" | "site_visit" | "note";
export type ActivityStatus = "open" | "completed" | "cancelled";

export type ClientEntity = {
  clientId: string;
  tenantId: string;
  name: string;
  status: ClientStatus;
  primaryContact?: string;
  phone?: string;
  email?: string;
};

export type ContactEntity = {
  contactId: string;
  tenantId: string;
  clientId: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  isPrimary: boolean;
};

export type CrmActivityEntity = {
  activityId: string;
  tenantId: string;
  clientId: string;
  type: ActivityType;
  status: ActivityStatus;
  title: string;
  dueAt?: string;
  assignedToUserId?: string;
};

export type CrmNoteEntity = {
  noteId: string;
  tenantId: string;
  clientId: string;
  body: string;
  createdByUserId: string;
};
