import { z } from "zod";

/** Runtime schemas mirror docs/api-contract.md. Every API response is parsed through them. */

export const FEATURE_COLUMNS = [
  "Time",
  ...Array.from({ length: 28 }, (_, i) => `V${i + 1}`),
  "Amount",
] as const;
export const OPTIONAL_COLUMNS = ["Class"] as const;

export const predictionSchema = z.enum(["fraud", "legitimate"]);
export const riskTierSchema = z.enum(["low", "medium", "high", "critical"]);
export const reviewStatusSchema = z.enum(["unreviewed", "in_review", "confirmed_fraud", "cleared"]);

export type Prediction = z.infer<typeof predictionSchema>;
export type RiskTier = z.infer<typeof riskTierSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const explanationSchema = z.object({
  method: z.string(),
  summary: z.string(),
  top_features: z.array(
    z.object({ feature: z.string(), value: z.number(), contribution: z.number() }),
  ),
});

export const transactionSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  amount: z.number(),
  time_offset_seconds: z.number().nullable().optional(),
  prediction: predictionSchema,
  fraud_probability: z.number().min(0).max(1),
  risk_tier: riskTierSchema,
  review_status: reviewStatusSchema,
  model_version: z.string(),
  threshold: z.number(),
  analysis_job_id: z.string().nullable().optional(),
  label: z.number().int().nullable().optional(),
  explanation: explanationSchema.nullable().optional(),
  features: z.record(z.number()).nullable().optional(),
});
export type Transaction = z.infer<typeof transactionSchema>;

export const healthSchema = z.object({
  status: z.string(),
  version: z.string(),
  model_loaded: z.boolean(),
  model_version: z.string().nullable(),
  database: z.enum(["not_configured", "connected", "error"]),
  timestamp: z.string(),
});
export type Health = z.infer<typeof healthSchema>;

export const dashboardSummarySchema = z.object({
  transactions_analyzed: z.number().int(),
  flagged_count: z.number().int(),
  review_queue_count: z.number().int(),
  flagged_amount: z.number(),
  volume_trend: z.array(
    z.object({ date: z.string(), total: z.number().int(), flagged: z.number().int() }),
  ),
  class_breakdown: z.object({ fraud: z.number().int(), legitimate: z.number().int() }),
  risk_distribution: z.array(z.object({ tier: riskTierSchema, count: z.number().int() })),
  recent_flagged: z.array(transactionSchema),
  model_version: z.string().nullable(),
  generated_at: z.string(),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

export const transactionPageSchema = z.object({
  items: z.array(transactionSchema),
  page: z.number().int(),
  page_size: z.number().int(),
  total: z.number().int(),
  total_pages: z.number().int(),
});
export type TransactionPage = z.infer<typeof transactionPageSchema>;

export const SORT_FIELDS = ["timestamp", "amount", "fraud_probability", "risk_tier"] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDir = "asc" | "desc";

export interface TransactionQuery {
  page?: number;
  page_size?: number;
  q?: string;
  prediction?: Prediction;
  risk_tier?: RiskTier;
  review_status?: ReviewStatus;
  min_amount?: number;
  max_amount?: number;
  date_from?: string;
  date_to?: string;
  sort_by?: SortField;
  sort_dir?: SortDir;
}

export const jobStatusSchema = z.enum(["queued", "running", "completed", "failed"]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const analyzeAcceptedSchema = z.object({
  job_id: z.string(),
  status: jobStatusSchema,
  row_count: z.number().int(),
  created_at: z.string(),
});
export type AnalyzeAccepted = z.infer<typeof analyzeAcceptedSchema>;

export const predictionResultSchema = z.object({
  prediction: predictionSchema,
  fraud_probability: z.number().min(0).max(1),
  risk_tier: riskTierSchema,
});

export const analysisJobSchema = z.object({
  job_id: z.string(),
  status: jobStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
  row_count: z.number().int(),
  processed_count: z.number().int(),
  model_version: z.string().nullable(),
  threshold: z.number().nullable(),
  summary: z
    .object({ flagged_count: z.number().int(), flagged_amount: z.number(), fraud_rate: z.number() })
    .nullable(),
  results: z
    .array(
      predictionResultSchema.extend({ row_index: z.number().int(), transaction_id: z.string() }),
    )
    .nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
});
export type AnalysisJob = z.infer<typeof analysisJobSchema>;

export const modelInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  algorithm: z.string(),
  training_run_id: z.string(),
  trained_at: z.string(),
  dataset: z.object({
    name: z.string(),
    source_url: z.string(),
    rows: z.number().int(),
    positive_rate: z.number(),
    sha256: z.string().nullable(),
  }),
  feature_schema: z.array(z.string()),
  threshold: z.number(),
  threshold_selection: z.string(),
  class_imbalance_strategy: z.string(),
  limitations: z.array(z.string()),
});
export type ModelInfo = z.infer<typeof modelInfoSchema>;

export const confusionMatrixSchema = z.object({
  tp: z.number().int(),
  fp: z.number().int(),
  tn: z.number().int(),
  fn: z.number().int(),
});
export type ConfusionMatrix = z.infer<typeof confusionMatrixSchema>;

export const thresholdPointSchema = confusionMatrixSchema.extend({
  threshold: z.number(),
  precision: z.number(),
  recall: z.number(),
  f1: z.number(),
});
export type ThresholdPoint = z.infer<typeof thresholdPointSchema>;

export const modelMetricsSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("evaluated"),
    model: modelInfoSchema,
    split: z.string(),
    threshold: z.number(),
    metrics: z.object({
      precision: z.number(),
      recall: z.number(),
      f1: z.number(),
      pr_auc: z.number(),
      roc_auc: z.number(),
      support_positive: z.number().int(),
      support_negative: z.number().int(),
    }),
    confusion_matrix: confusionMatrixSchema,
    threshold_curve_split: z.string(),
    threshold_curve: z.array(thresholdPointSchema),
    evaluated_at: z.string(),
  }),
  z.object({
    status: z.literal("not_evaluated"),
    model: modelInfoSchema.nullable(),
    reason: z.string(),
  }),
]);
export type ModelMetrics = z.infer<typeof modelMetricsSchema>;
export type EvaluatedMetrics = Extract<ModelMetrics, { status: "evaluated" }>;

export const predictResponseSchema = z.object({
  model_version: z.string(),
  threshold: z.number(),
  predictions: z.array(predictionResultSchema.extend({ index: z.number().int() })),
});
export type PredictResponse = z.infer<typeof predictResponseSchema>;

export type FeatureRow = Record<(typeof FEATURE_COLUMNS)[number], number>;

export const errorEnvelopeSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});