import type { DemoRole } from "../../../src/core/types/roles";
import type { RequestContext } from "../core/requestContext";

export type NotificationChannel = "in_app" | "push_future" | "email_future" | "sms_future";
export type NotificationSeverity = "info" | "warning" | "critical";

export type NotificationInput = {
  audienceRole: DemoRole;
  title: string;
  message: string;
  severity: NotificationSeverity;
  channel: NotificationChannel;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

export type NotificationWriter = {
  enqueue(context: RequestContext, input: NotificationInput): Promise<string>;
};

export const notificationPolicy = {
  enabledChannels: ["in_app"],
  futureChannelsRequireConsent: ["push_future", "email_future", "sms_future"],
  nativePushProvider: "fcm-planned",
  auditEveryDelivery: true,
} as const;
