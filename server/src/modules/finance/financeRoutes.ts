import type { ApiRouteContract } from "../../core/httpTypes";

export const financeApiRoutes: ApiRouteContract[] = [
  {
    method: "GET",
    path: "/api/finance/accounts",
    moduleId: "finance",
    capability: "finance.read",
    handlerName: "finance.accounts.list",
    authRequired: true,
    auditEvent: "finance.accounts.read",
  },
  {
    method: "GET",
    path: "/api/finance/transactions",
    moduleId: "finance",
    capability: "cashflow.read",
    handlerName: "finance.transactions.list",
    authRequired: true,
    auditEvent: "finance.transactions.read",
  },
  {
    method: "POST",
    path: "/api/finance/transactions",
    moduleId: "finance",
    capability: "finance.manage",
    handlerName: "finance.transactions.create",
    authRequired: true,
    auditEvent: "finance.transaction.created",
  },
];
