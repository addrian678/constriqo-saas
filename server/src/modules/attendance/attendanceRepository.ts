import type { RequestContext } from "../../core/requestContext";
import type { ListResult, RepositoryResult } from "../../persistence/repositoryContracts";
import type { AttendanceApprovalEntity, BreakEntryEntity, TimeEntryEntity } from "./attendanceDomain";

export type ClockInInput = {
  workerId: string;
  jobId?: string;
};

export type ClockOutInput = {
  timeEntryId: string;
};

export type AttendanceRepository = {
  listTimeEntries(context: RequestContext, workerId?: string): Promise<ListResult<TimeEntryEntity>>;
  clockIn(context: RequestContext, input: ClockInInput): Promise<RepositoryResult<TimeEntryEntity>>;
  clockOut(context: RequestContext, input: ClockOutInput): Promise<RepositoryResult<TimeEntryEntity>>;
  startBreak(context: RequestContext, timeEntryId: string): Promise<RepositoryResult<BreakEntryEntity>>;
  approveTimeEntry(context: RequestContext, timeEntryId: string): Promise<RepositoryResult<AttendanceApprovalEntity>>;
};
