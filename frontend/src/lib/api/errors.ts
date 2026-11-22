export type ApiErrorCode =
  | "not_configured"
  | "network_error"
  | "timeout"
  | "invalid_response"
  | "model_not_available"
  | "csv_invalid"
  | "file_too_large"
  | "validation_error"
  | "not_found"
  | "bad_request"
  | "internal_error"
  | (string & {});

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: unknown;

  constructor(message: string, opts: { status: number; code: ApiErrorCode; details?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details ?? null;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export interface CsvIssue {
  row: number | null;
  column: string | null;
  message: string;
}

/** Pull `{row, column, message}` issues out of a csv_invalid error's details. */
export function csvIssuesFrom(error: unknown): CsvIssue[] {
  if (!isApiError(error) || error.code !== "csv_invalid") return [];
  const details = error.details as { errors?: unknown } | null;
  if (!details || !Array.isArray(details.errors)) return [];
  return details.errors
    .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
    .map((e) => ({
      row: typeof e["row"] === "number" ? e["row"] : null,
      column: typeof e["column"] === "string" ? e["column"] : null,
      message: typeof e["message"] === "string" ? e["message"] : "Invalid value",
    }));
}

/** Short, user-facing description for any error thrown by the API client. */
export function describeError(error: unknown): string {
  if (!isApiError(error)) return "Something unexpected went wrong.";
  switch (error.code) {
    case "not_configured":
      return "The backend is not connected. Set VITE_API_BASE_URL to your FraudLens API.";
    case "network_error":
      return "Could not reach the backend. Check that it is running and that CORS allows this site.";
    case "timeout":
      return "The backend took too long to respond.";
    case "invalid_response":
      return "The backend replied with data in an unexpected format (API contract mismatch).";
    case "model_not_available":
      return "The backend is running, but no trained model is loaded yet.";
    default:
      return error.message;
  }
}