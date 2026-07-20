import { requestJson } from "../../../app/auth/authClient";

export type JobStatus = "planned" | "in_progress" | "paused" | "change_pending" | "closed";

export type JobSummary = {
  jobId: string;
  clientId: string;
  clientName: string;
  estimateId?: string | null;
  estimateNumber?: string;
  jobNumber: string;
  title: string;
  status: JobStatus;
  scheduledStart?: string;
  scheduledEnd?: string;
  projectAddress?: string;
  projectLatitude?: number | null;
  projectLongitude?: number | null;
  allowedRadiusMeters?: number;
  openTasks: number;
  completedTasks: number;
  totalTasks: number;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
};

export type JobPhase = {
  phaseId: string;
  title: string;
  status: "pending" | "active" | "completed";
  sortOrder: number;
  startsOn?: string;
  endsOn?: string;
};

export type JobTask = {
  taskId: string;
  phaseId?: string | null;
  title: string;
  status: "pending" | "in_progress" | "blocked" | "completed";
  assignedToWorkerId?: string | null;
  assignedWorkerName?: string;
  dueAt?: string;
};

export type WorkerTask = JobTask & {
  jobId: string;
  jobNumber: string;
  jobTitle: string;
  jobStatus: JobStatus;
  clientName: string;
  phaseTitle: string;
  jobTotalTasks: number;
  jobCompletedTasks: number;
  jobProgressPercent: number;
};

export type JobChangeRequest = {
  changeRequestId: string;
  title: string;
  description: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  amountDelta: number;
  createdAt: string;
};

export type JobAssignment = {
  assignmentId: string;
  workerId: string;
  workerName: string;
  startsAt: string;
  endsAt?: string;
  status: string;
};

export type JobDetailResponse = {
  job: JobSummary;
  phases: JobPhase[];
  tasks: JobTask[];
  assignments: JobAssignment[];
  changeRequests: JobChangeRequest[];
};

export type JobInput = {
  clientId: string;
  estimateId?: string | null;
  jobNumber?: string;
  title: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  projectAddress?: string;
  projectLatitude?: number | null;
  projectLongitude?: number | null;
  allowedRadiusMeters?: number;
  phases?: string[];
};

export async function listJobs(token: string): Promise<{ items: JobSummary[]; summary: Record<string, number> }> {
  return requestJson<{ items: JobSummary[]; summary: Record<string, number> }>("/api/jobs", {
    method: "GET",
    token,
  });
}

export async function createJob(token: string, input: JobInput): Promise<JobSummary> {
  const response = await requestJson<{ job: JobSummary }>("/api/jobs", {
    method: "POST",
    token,
    body: input,
  });
  return response.job;
}

export async function updateJob(token: string, jobId: string, input: Partial<JobInput> & { status?: JobStatus }): Promise<JobSummary> {
  const response = await requestJson<{ job: JobSummary }>(`/api/jobs/${jobId}`, {
    method: "PATCH",
    token,
    body: input,
  });
  return response.job;
}

export async function assignWorkerToJob(token: string, jobId: string, workerId: string): Promise<JobAssignment> {
  const response = await requestJson<{ assignment: JobAssignment }>(`/api/jobs/${jobId}/assignments`, {
    method: "POST",
    token,
    body: { workerId },
  });
  return response.assignment;
}

export async function getJob(token: string, jobId: string): Promise<JobDetailResponse> {
  return requestJson<JobDetailResponse>(`/api/jobs/${jobId}`, {
    method: "GET",
    token,
  });
}

export async function createJobTask(
  token: string,
  jobId: string,
  input: { title: string; jobPhaseId?: string | null; assignedToWorkerId?: string | null; dueAt?: string },
): Promise<JobTask> {
  const response = await requestJson<{ task: JobTask }>(`/api/jobs/${jobId}/tasks`, {
    method: "POST",
    token,
    body: input,
  });
  return response.task;
}

export async function updateJobTask(
  token: string,
  jobId: string,
  taskId: string,
  input: { status?: JobTask["status"]; assignedToWorkerId?: string | null; dueAt?: string },
): Promise<JobTask> {
  const response = await requestJson<{ task: JobTask }>(`/api/jobs/${jobId}/tasks/${taskId}`, {
    method: "PATCH",
    token,
    body: input,
  });
  return response.task;
}

export async function listWorkerTasks(
  token: string,
): Promise<{ worker: { workerId: string; name: string; status: string }; items: WorkerTask[]; summary: Record<string, number> }> {
  return requestJson<{ worker: { workerId: string; name: string; status: string }; items: WorkerTask[]; summary: Record<string, number> }>("/api/worker/tasks", {
    method: "GET",
    token,
  });
}

export async function updateWorkerTask(token: string, taskId: string, input: { status: JobTask["status"]; reportNote?: string }): Promise<JobTask> {
  const response = await requestJson<{ task: JobTask }>(`/api/worker/tasks/${taskId}`, {
    method: "PATCH",
    token,
    body: input,
  });
  return response.task;
}

export async function createJobChangeRequest(
  token: string,
  jobId: string,
  input: { title: string; description?: string; amountDelta?: number },
): Promise<JobChangeRequest> {
  const response = await requestJson<{ changeRequest: JobChangeRequest }>(`/api/jobs/${jobId}/change-requests`, {
    method: "POST",
    token,
    body: input,
  });
  return response.changeRequest;
}
