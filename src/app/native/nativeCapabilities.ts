import type { AttendanceLocation } from "../../modules/attendance/api/attendanceClient";
import { saveBlobAsFile } from "../auth/authClient";

export async function capturePointInTimeLocation(): Promise<AttendanceLocation> {
  if (!navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: position.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}

export type NativeRuntimeKind = "web" | "android-wrapper-ready";

export type NativeRuntimeInfo = {
  runtime: NativeRuntimeKind;
  location: "web-geolocation" | "native-plugin-future" | "unavailable";
  notifications: "browser-permission" | "native-push-future" | "unavailable";
  files: "browser-download" | "native-files-future";
  syncQueue: "memory-only-no-offline-writes";
};

export type NotificationConsentStatus = "unsupported" | "not-requested" | "granted" | "denied";

export type QueuedNativeOperation<TPayload = unknown> = {
  id: string;
  type: "document-sync" | "evidence-sync" | "notification-ack" | "generic";
  payload: TPayload;
  createdAt: string;
  attempts: number;
};

export function getNativeRuntimeInfo(): NativeRuntimeInfo {
  const capacitorLike = Boolean((globalThis as { Capacitor?: unknown }).Capacitor);
  return {
    runtime: capacitorLike ? "android-wrapper-ready" : "web",
    location: navigator.geolocation ? "web-geolocation" : capacitorLike ? "native-plugin-future" : "unavailable",
    notifications: "Notification" in globalThis ? "browser-permission" : capacitorLike ? "native-push-future" : "unavailable",
    files: capacitorLike ? "native-files-future" : "browser-download",
    syncQueue: "memory-only-no-offline-writes",
  };
}

export function getNotificationConsentStatus(): NotificationConsentStatus {
  if (!("Notification" in globalThis)) {
    return "unsupported";
  }
  const permission = Notification.permission;
  if (permission === "default") {
    return "not-requested";
  }
  return permission === "granted" ? "granted" : "denied";
}

export async function requestNotificationConsent(userConfirmed: boolean): Promise<NotificationConsentStatus> {
  if (!userConfirmed || !("Notification" in globalThis)) {
    return getNotificationConsentStatus();
  }
  const permission = await Notification.requestPermission();
  return permission === "default" ? "not-requested" : permission;
}

export function saveDocumentToCurrentDevice(blob: Blob, filename: string): void {
  saveBlobAsFile(blob, sanitizeDeviceFilename(filename));
}

export function sanitizeDeviceFilename(filename: string): string {
  const cleaned = filename
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "constructflow-document.pdf";
}

export function createEphemeralSyncQueue() {
  const items: Array<QueuedNativeOperation> = [];

  return {
    enqueue<TPayload>(operation: Omit<QueuedNativeOperation<TPayload>, "id" | "createdAt" | "attempts">) {
      const item: QueuedNativeOperation<TPayload> = {
        ...operation,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        attempts: 0,
      };
      items.push(item as QueuedNativeOperation);
      return item;
    },
    list() {
      return [...items];
    },
    markAttempt(operationId: string) {
      const item = items.find((operation) => operation.id === operationId);
      if (item) {
        item.attempts += 1;
      }
      return item || null;
    },
    remove(operationId: string) {
      const index = items.findIndex((operation) => operation.id === operationId);
      if (index >= 0) {
        items.splice(index, 1);
      }
    },
    clear() {
      items.splice(0, items.length);
    },
  };
}
