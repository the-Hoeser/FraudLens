import type { ZodType } from "zod";

import { getApiBaseUrl } from "./config";
import { ApiError } from "./errors";
import {
  analysisJobSchema,
  analyzeAcceptedSchema,
  dashboardSummarySchema,
  errorEnvelopeSchema,
  healthSchema,
  modelMetricsSchema,
  modelInfoResponseSchema,
  predictResponseSchema,
  transactionPageSchema,
  transactionSchema,
  type FeatureRow,
  type ModelInfoResponse,
  type TransactionQuery,
} from "./types";

export interface ApiClientOptions {
  baseUrl: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type QueryValue = string | number | boolean | null | undefined;

/** Join base + path and append defined, non-empty query values. */
export function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(baseUrl.replace(/\/+$/, "") + (path.startsWith("/") ? path : `/${path}`));
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      if (typeof value === "number" && !Number.isFinite(value)) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export function transactionQueryToParams(q: TransactionQuery): Record<string, QueryValue> {
  return {
    page: q.page,
    page_size: q.page_size,
    q: q.q?.trim(),
    prediction: q.prediction,
    risk_tier: q.risk_tier,
    review_status: q.review_status,
    min_amount: q.min_amount,
    max_amount: q.max_amount,
    date_from: q.date_from,
    date_to: q.date_to,
    sort_by: q.sort_by,
    sort_dir: q.sort_dir,
  };
}

export function createApiClient(options: ApiClientOptions) {
  const { baseUrl, timeoutMs = 15_000 } = options;
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function request<T>(
    path: string,
    schema: ZodType<T>,
    init: RequestInit & { query?: Record<string, QueryValue> } = {},
  ): Promise<T> {
    if (!baseUrl) {
      throw new ApiError("Backend not configured", { status: 0, code: "not_configured" });
    }
    const { query, timeoutMs: requestTimeoutMs = timeoutMs, ...rest } = init;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(buildUrl(baseUrl, path, query), {
        ...rest,
        headers: { Accept: "application/json", ...(rest.headers ?? {}) },
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new ApiError("Request timed out", { status: 0, code: "timeout" });
      }
      throw new ApiError("Network request failed", { status: 0, code: "network_error" });
    } finally {
      clearTimeout(timer);
    }

    let body: unknown = null;
    const text = await response.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }

    if (!response.ok) {
      const envelope = errorEnvelopeSchema.safeParse(body);
      if (envelope.success) {
        throw new ApiError(envelope.data.error.message, {
          status: response.status,
          code: envelope.data.error.code,
          details: envelope.data.error.details,
        });
      }
      throw new ApiError(`Request failed with status ${response.status}`, {
        status: response.status,
        code: response.status === 404 ? "not_found" : "internal_error",
      });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("Response did not match the API contract", {
        status: response.status,
        code: "invalid_response",
        details: parsed.error.issues.slice(0, 5),
      });
    }
    return parsed.data;
  }

  return {
    baseUrl,
    getHealth: () => request("/health", healthSchema),
    getDashboardSummary: () => request("/api/dashboard/summary", dashboardSummarySchema),
    listTransactions: (q: TransactionQuery = {}) =>
      request("/api/transactions", transactionPageSchema, { query: transactionQueryToParams(q) }),
    getTransaction: (id: string) =>
      request(`/api/transactions/${encodeURIComponent(id)}`, transactionSchema),
    submitAnalysis: (file: File | Blob, filename = "upload.csv") => {
      const form = new FormData();
      form.append("file", file, file instanceof File ? file.name : filename);
      // Large benchmark CSVs upload directly from the browser to FastAPI; do not
      // abort the request using the short default timeout for small JSON calls.
      return request("/api/analyze", analyzeAcceptedSchema, {
        method: "POST",
        body: form,
        timeoutMs: 15 * 60 * 1000,
      });
    },
    getAnalysisJob: (jobId: string) =>
      request(`/api/analyze/${encodeURIComponent(jobId)}`, analysisJobSchema),
    getModelMetrics: () => request("/api/model/metrics", modelMetricsSchema),
    getModelInfo: () => request<ModelInfoResponse>("/api/model/info", modelInfoResponseSchema),
    predict: (transactions: FeatureRow[]) =>
      request("/api/predict", predictResponseSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions }),
      }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export const apiClient: ApiClient = createApiClient({ baseUrl: getApiBaseUrl() });