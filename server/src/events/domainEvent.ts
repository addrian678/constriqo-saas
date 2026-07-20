import type { RequestContext } from "../core/requestContext";

export type DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  eventId: string;
  tenantId: string;
  moduleId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
  occurredAt: string;
};

export type EventPublishOptions = {
  audit: boolean;
  notify: boolean;
};

export type EventPublisher = {
  publish<TPayload extends Record<string, unknown>>(
    context: RequestContext,
    event: Omit<DomainEvent<TPayload>, "eventId" | "tenantId" | "occurredAt">,
    options: EventPublishOptions,
  ): Promise<DomainEvent<TPayload>>;
};
