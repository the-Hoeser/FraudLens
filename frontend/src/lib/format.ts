const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("en-US");

/** Amounts in the ULB dataset carry no currency; "$" is a display convention only. */
export const formatAmount = (n: number) => currency.format(n);
export const formatCompactAmount = (n: number) => compactCurrency.format(n);
export const formatInt = (n: number) => integer.format(n);
export const formatPercent = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;
export const formatScore = (n: number) => n.toFixed(3);

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }) + " UTC";
}

export function formatDay(isoDate: string): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export const REVIEW_LABELS = {
  unreviewed: "Unreviewed",
  in_review: "In review",
  confirmed_fraud: "Confirmed fraud",
  cleared: "Cleared",
} as const;

export const RISK_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
} as const;