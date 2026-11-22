import type { LucideIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  loading,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  icon: LucideIcon;
  tone?: "default" | "fraud" | "warning" | "signal";
  loading?: boolean;
}) {
  const toneClass = {
    default: "text-primary",
    fraud: "text-fraud",
    warning: "text-warning",
    signal: "text-signal",
  }[tone];

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className={`size-4 ${toneClass}`} aria-hidden />
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-28" />
      ) : (
        <p className="numeric mt-2 text-3xl font-semibold text-foreground">{value}</p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <span aria-hidden className={`absolute inset-x-0 bottom-0 h-px bg-current opacity-40 ${toneClass}`} />
    </div>
  );
}