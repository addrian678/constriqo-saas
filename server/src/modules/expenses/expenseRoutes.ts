import type { ApiRouteContract } from "../../core/httpTypes";

export const expenseApiRoutes: ApiRouteContract[] = [
  {
    method: "GET",
    path: "/api/expenses",
    moduleId: "expenses",
    capability: "expenses.read",
    handlerName: "expenses.list",
    authRequired: true,
    auditEvent: "expenses.read",
  },
  {
    method: "POST",
    path: "/api/expenses",
    moduleId: "expenses",
    capability: "expenses.create",
    handlerName: "expenses.create",
    authRequired: true,
    auditEvent: "expenses.created",
  },
  {
    method: "POST",
    path: "/api/expenses/:expenseId/approve",
    moduleId: "expenses",
    capability: "expenses.approve",
    handlerName: "expenses.approve",
    authRequired: true,
    auditEvent: "expenses.approved",
  },
];
