import type { ApiRouteContract } from "../../core/httpTypes";

export const workProofApiRoutes: ApiRouteContract[] = [
  {
    method: "GET",
    path: "/api/work-proofs/field-reports",
    moduleId: "work-proofs",
    capability: "field-reports.read",
    handlerName: "workProofs.fieldReports.list",
    authRequired: true,
    auditEvent: "work_proofs.field_reports.read",
  },
  {
    method: "POST",
    path: "/api/work-proofs/field-reports",
    moduleId: "work-proofs",
    capability: "field-reports.create",
    handlerName: "workProofs.fieldReports.create",
    authRequired: true,
    auditEvent: "work_proofs.field_report.created",
  },
  {
    method: "POST",
    path: "/api/work-proofs/proofs",
    moduleId: "work-proofs",
    capability: "proofs.self.visual",
    handlerName: "workProofs.proofs.create",
    authRequired: true,
    auditEvent: "work_proofs.proof.created",
  },
];
