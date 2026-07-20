import type { RequestContext } from "../core/requestContext";

export type AuditSeverity = "info" | "warning" | "critical";

export type AuditEventInput = {
  action: string;
  moduleId: string;
  entityType?: string;
  entityId?: string;
  severity: AuditSeverity;
  metadata: Record<string, unknown>;
};

export type AuditWriter = {
  write(context: RequestContext, event: AuditEventInput): Promise<string>;
};
