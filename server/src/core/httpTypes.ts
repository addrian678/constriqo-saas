export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type ApiRouteContract = {
  method: HttpMethod;
  path: string;
  moduleId: string;
  capability: string;
  handlerName: string;
  authRequired: boolean;
  auditEvent: string;
};

export type ApiResponse<TBody> = {
  status: number;
  body: TBody;
};

export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_ADAPTER_NOT_CONFIGURED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "NOT_IMPLEMENTED"
  | "REQUEST_TOO_LARGE"
  | "INTERNAL";
