import { requestJson } from "../../../app/auth/authClient";

export type AttendanceStatus = "active" | "on_break" | "submitted" | "approved" | "rejected" | "cancelled";

export type AttendanceLocation = {
  lat: number;
  lng: number;
  accuracyM?: number | null;
} | null;

export type TimeEntry = {
  timeEntryId: string;
  workerId: string;
  workerName: string;
  jobId?: string | null;
  jobNumber: string;
  jobTitle: string;
  clockIn: string;
  clockOut: string;
  status: AttendanceStatus;
  submittedAt: string;
  breakSeconds: number;
  totalSeconds: number;
  activeBreak?: {
    breakEntryId: string;
    startedAt: string;
    plannedMinutes: number;
  } | null;
  clockInLocation: AttendanceLocation;
  clockOutLocation: AttendanceLocation;
  jobDistanceMeters?: number | null;
  locationStatus?: "inside_radius" | "outside_radius" | "job_without_location" | "missing_worker_location" | "not_checked";
  clockInNote: string;
  clockOutNote: string;
  cancelledAt?: string;
  cancelReason?: string;
  payrollStatus?: "unpaid" | "paid" | "excluded";
};

export type MyAttendance = {
  worker: { workerId: string; name: string; status: string };
  openEntry: TimeEntry | null;
  recentEntries: TimeEntry[];
  summary: Record<string, number>;
};

export async function listTimeEntries(token: string): Promise<{ items: TimeEntry[]; summary: Record<string, number> }> {
  return requestJson<{ items: TimeEntry[]; summary: Record<string, number> }>("/api/attendance/time-entries", {
    method: "GET",
    token,
  });
}

export async function getMyAttendance(token: string): Promise<MyAttendance> {
  return requestJson<MyAttendance>("/api/attendance/me", {
    method: "GET",
    token,
  });
}

export async function clockIn(token: string, input: { jobId?: string | null; location?: AttendanceLocation; note?: string }): Promise<TimeEntry> {
  const response = await requestJson<{ entry: TimeEntry }>("/api/attendance/clock-in", {
    method: "POST",
    token,
    body: input,
  });
  return response.entry;
}

export async function cancelEntry(token: string, input: { reason?: string } = {}): Promise<TimeEntry> {
  const response = await requestJson<{ entry: TimeEntry }>("/api/attendance/cancel-entry", {
    method: "POST",
    token,
    body: input,
  });
  return response.entry;
}

export async function startBreak(token: string, input: { plannedMinutes: number }): Promise<TimeEntry> {
  const response = await requestJson<{ entry: TimeEntry }>("/api/attendance/break-start", {
    method: "POST",
    token,
    body: input,
  });
  return response.entry;
}

export async function endBreak(token: string): Promise<TimeEntry> {
  const response = await requestJson<{ entry: TimeEntry }>("/api/attendance/break-end", {
    method: "POST",
    token,
    body: {},
  });
  return response.entry;
}

export async function clockOut(token: string, input: { location?: AttendanceLocation; note?: string }): Promise<TimeEntry> {
  const response = await requestJson<{ entry: TimeEntry }>("/api/attendance/clock-out", {
    method: "POST",
    token,
    body: input,
  });
  return response.entry;
}

export async function approveTimeEntry(token: string, timeEntryId: string, input: { status?: "approved" | "rejected"; notes?: string } = {}): Promise<TimeEntry> {
  const response = await requestJson<{ entry: TimeEntry }>(`/api/attendance/time-entries/${timeEntryId}/approve`, {
    method: "POST",
    token,
    body: input,
  });
  return response.entry;
}
