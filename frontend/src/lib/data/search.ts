import {
  predictionSchema,
  reviewStatusSchema,
  riskTierSchema,
  SORT_FIELDS,
  type SortField,
  type TransactionQuery,
} from "@/lib/api/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function num(v: unknown, min = 0): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min ? n : undefined;
}

/** Sanitize untrusted URL search params into a TransactionQuery (unknown values dropped). */
export function parseTransactionSearch(search: Record<string, unknown>): TransactionQuery {
  const out: TransactionQuery = {};
  const page = num(search["page"], 1);
  if (page !== undefined) out.page = Math.floor(page);
  const pageSize = num(search["page_size"], 1);
  if (pageSize !== undefined) out.page_size = Math.min(100, Math.floor(pageSize));
  if (typeof search["q"] === "string" && search["q"].trim() !== "") out.q = search["q"].slice(0, 80);
  const pred = predictionSchema.safeParse(search["prediction"]);
  if (pred.success) out.prediction = pred.data;
  const tier = riskTierSchema.safeParse(search["risk_tier"]);
  if (tier.success) out.risk_tier = tier.data;
  const review = reviewStatusSchema.safeParse(search["review_status"]);
  if (review.success) out.review_status = review.data;
  const min = num(search["min_amount"]);
  if (min !== undefined) out.min_amount = min;
  const max = num(search["max_amount"]);
  if (max !== undefined) out.max_amount = max;
  for (const key of ["date_from", "date_to"] as const) {
    const v = search[key];
    if (typeof v === "string" && DATE_RE.test(v)) out[key] = v;
  }
  const sortBy = search["sort_by"];
  if (typeof sortBy === "string" && (SORT_FIELDS as readonly string[]).includes(sortBy)) {
    out.sort_by = sortBy as SortField;
  }
  if (search["sort_dir"] === "asc" || search["sort_dir"] === "desc") out.sort_dir = search["sort_dir"];
  return out;
}