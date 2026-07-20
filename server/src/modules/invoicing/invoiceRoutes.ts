import type { ApiRouteContract } from "../../core/httpTypes";

export const invoiceApiRoutes: ApiRouteContract[] = [
  {
    method: "GET",
    path: "/api/invoicing/invoices",
    moduleId: "invoicing",
    capability: "invoices.read",
    handlerName: "invoicing.invoices.list",
    authRequired: true,
    auditEvent: "invoicing.invoices.read",
  },
  {
    method: "POST",
    path: "/api/invoicing/invoices",
    moduleId: "invoicing",
    capability: "invoices.create",
    handlerName: "invoicing.invoices.create",
    authRequired: true,
    auditEvent: "invoicing.invoice.created",
  },
  {
    method: "POST",
    path: "/api/invoicing/payments",
    moduleId: "invoicing",
    capability: "payments.record",
    handlerName: "invoicing.payments.record",
    authRequired: true,
    auditEvent: "invoicing.payment.recorded",
  },
];
