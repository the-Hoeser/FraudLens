import type {
  DashboardSummary,
  Transaction,
  TransactionPage,
  TransactionQuery,
} from "@/lib/api/types";
import { RISK_ORDER, RISK_TIERS } from "@/lib/risk";

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** Same filter/sort/paginate semantics as GET /api/transactions, applied in memory. */
export function queryTransactions(all: Transaction[], q: TransactionQuery = {}): TransactionPage {
  const pageSize = Math.min(Math.max(q.page_size ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const needle = q.q?.trim().toLowerCase();

  const filtered = all.filter((t) => {
    if (needle && !t.id.toLowerCase().includes(needle)) return false;
    if (q.prediction && t.prediction !== q.prediction) return false;
    if (q.risk_tier && t.risk_tier !== q.risk_tier) return false;
    if (q.review_status && t.review_status !== q.review_status) return false;
    if (q.min_amount !== undefined && t.amount < q.min_amount) return false;
    if (q.max_amount !== undefined && t.amount > q.max_amount) return false;
    const day = t.timestamp.slice(0, 10);
    if (q.date_from && day < q.date_from) return false;
    if (q.date_to && day > q.date_to) return false;
    return true;
  });

  const sortBy = q.sort_by ?? "timestamp";
  const dir = q.sort_dir === "asc" ? 1 : -1;
  const sorted = [...filtered].sort((a, b) => {
    let cmp: number;
    switch (sortBy) {
      case "amount":
        cmp = a.amount - b.amount;
        break;
      case "fraud_probability":
        cmp = a.fraud_probability - b.fraud_probability;
        break;
      case "risk_tier":
        cmp = RISK_ORDER[a.risk_tier] - RISK_ORDER[b.risk_tier] || a.fraud_probability - b.fraud_probability;
        break;
      default:
        cmp = a.timestamp.localeCompare(b.timestamp);
    }
    return cmp === 0 ? a.id.localeCompare(b.id) * dir : cmp * dir;
  });

  const total = sorted.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const page = Math.max(1, Math.min(q.page ?? 1, Math.max(totalPages, 1)));
  const start = (page - 1) * pageSize;

  return {
    items: sorted.slice(start, start + pageSize),
    page,
    page_size: pageSize,
    total,
    total_pages: totalPages,
  };
}

/** Same aggregation as GET /api/dashboard/summary. */
export function summarizeTransactions(
  all: Transaction[],
  generatedAt: string,
  modelVersion: string | null,
): DashboardSummary {
  const flagged = all.filter((t) => t.prediction === "fraud");
  const byDay = new Map<string, { total: number; flagged: number }>();
  for (const t of all) {
    const day = t.timestamp.slice(0, 10);
    const entry = byDay.get(day) ?? { total: 0, flagged: 0 };
    entry.total += 1;
    if (t.prediction === "fraud") entry.flagged += 1;
    byDay.set(day, entry);
  }

  return {
    transactions_analyzed: all.length,
    flagged_count: flagged.length,
    review_queue_count: flagged.filter(
      (t) => t.review_status === "unreviewed" || t.review_status === "in_review",
    ).length,
    flagged_amount: Math.round(flagged.reduce((s, t) => s + t.amount, 0) * 100) / 100,
    volume_trend: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v })),
    class_breakdown: { fraud: flagged.length, legitimate: all.length - flagged.length },
    risk_distribution: RISK_TIERS.map((tier) => ({
      tier,
      count: all.filter((t) => t.risk_tier === tier).length,
    })),
    recent_flagged: [...flagged]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 10)
      .map(({ features: _features, ...rest }) => rest),
    model_version: modelVersion,
    generated_at: generatedAt,
  };
}