import type { ApiErrorCode, ApiResponse } from "./httpTypes";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function toErrorResponse(error: unknown): ApiResponse<{ code: ApiErrorCode; message: string }> {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: {
        code: error.code,
        message: error.message,
      },
    };
  }

  return {
    status: 500,
    body: {
      code: "INTERNAL",
      message: "Unexpected server error",
    },
  };
}
