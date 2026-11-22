import { queryOptions } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import { isApiConfigured } from "@/lib/api/config";
import { ApiError } from "@/lib/api/errors";
import type { TransactionQuery } from "@/lib/api/types";
import { DEMO_END_DATE, DEMO_MODEL_VERSION, demoTransactions } from "@/lib/demo/fixtures";
import { queryTransactions, summarizeTransactions } from "@/lib/demo/transforms";

/**
 * Where dashboard/transaction data comes from:
 *  - "live": VITE_API_BASE_URL is set → always the API. Failures surface as errors;
 *    we never silently fall back to demo data.
 *  - "demo": no backend configured → clearly labelled fixtures for UI preview.
 * Model metrics, the registry and analysis jobs have NO demo mode.
 */
export type DataSource = "live" | "demo";
export const dataSource: DataSource = isApiConfigured() ? "live" : "demo";
export const isDemo = dataSource === "demo";

export const dashboardQuery = () =>
  queryOptions({
    queryKey: ["dashboard", dataSource],
    queryFn: async () =>
      isDemo
        ? summarizeTransactions(demoTransactions(), DEMO_END_DATE, DEMO_MODEL_VERSION)
        : apiClient.getDashboardSummary(),
  });

export const transactionsQuery = (q: TransactionQuery) =>
  queryOptions({
    queryKey: ["transactions", dataSource, q],
    queryFn: async () => (isDemo ? queryTransactions(demoTransactions(), q) : apiClient.listTransactions(q)),
    placeholderData: (prev) => prev,
  });

export const transactionQuery = (id: string) =>
  queryOptions({
    queryKey: ["transaction", dataSource, id],
    queryFn: async () => {
      if (!isDemo) return apiClient.getTransaction(id);
      const t = demoTransactions().find((x) => x.id === id);
      if (!t) throw new ApiError("Transaction not found", { status: 404, code: "not_found" });
      return t;
    },
  });

export const healthQuery = () =>
  queryOptions({
    queryKey: ["health"],
    queryFn: async () => {
      const started = performance.now();
      const data = await apiClient.getHealth();
      return { data, latencyMs: Math.round(performance.now() - started) };
    },
    enabled: isApiConfigured(),
    retry: false,
  });

export const modelMetricsQuery = () =>
  queryOptions({
    queryKey: ["model-metrics"],
    queryFn: () => apiClient.getModelMetrics(),
    enabled: isApiConfigured(),
    retry: false,
  });