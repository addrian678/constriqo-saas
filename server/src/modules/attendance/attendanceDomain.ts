export type TimeEntryStatus = "open" | "submitted" | "approved" | "rejected";
export type BreakStatus = "open" | "closed" | "adjusted";
export type AttendanceExceptionStatus = "open" | "approved" | "rejected";

export type TimeEntryEntity = {
  timeEntryId: string;
  tenantId: string;
  workerId: string;
  jobId?: string;
  clockIn: string;
  clockOut?: string;
  status: TimeEntryStatus;
};

export type BreakEntryEntity = {
  breakEntryId: string;
  tenantId: string;
  timeEntryId: string;
  startedAt: string;
  endedAt?: string;
  status: BreakStatus;
};

export type AttendanceApprovalEntity = {
  attendanceApprovalId: string;
  tenantId: string;
  timeEntryId: string;
  status: "approved" | "rejected";
  reviewedByUserId: string;
};
