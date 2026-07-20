import type { ApiRouteContract } from "../../core/httpTypes";

export const jobApiRoutes: ApiRouteContract[] = [
  {
    method: "GET",
    path: "/api/jobs",
    moduleId: "jobs",
    capability: "jobs.read",
    handlerName: "jobs.list",
    authRequired: true,
    auditEvent: "jobs.read",
  },
  {
    method: "POST",
    path: "/api/jobs",
    moduleId: "jobs",
    capability: "jobs.create",
    handlerName: "jobs.create",
    authRequired: true,
    auditEvent: "jobs.created",
  },
  {
    method: "POST",
    path: "/api/jobs/:jobId/tasks",
    moduleId: "jobs",
    capability: "jobs.update",
    handlerName: "jobs.tasks.create",
    authRequired: true,
    auditEvent: "jobs.task.created",
  },
  {
    method: "POST",
    path: "/api/jobs/:jobId/change-requests",
    moduleId: "jobs",
    capability: "jobs.update",
    handlerName: "jobs.changeRequests.create",
    authRequired: true,
    auditEvent: "jobs.change_request.created",
  },
];
