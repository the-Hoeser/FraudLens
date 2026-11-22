import { useQuery } from "@tanstack/react-query";

import { DemoTag, PredictionBadge, ReviewBadge, RiskBadge } from "@/components/common/badges";
import { ErrorState } from "@/components/common/StateViews";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { Transaction } from "@/lib/api/types";
import { isDemo, transactionQuery } from "@/lib/data/source";
import { formatAmount, formatDateTime, formatPercent } from "@/lib/format";

export function TransactionDrawer({
  transactionId,
  onOpenChange,
}: {
  transactionId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const query = useQuery({ ...transactionQuery(transactionId ?? ""), enabled: transactionId !== null });

  return (
    <Sheet open={transactionId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-border bg-surface sm:max-w-lg">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-2">
            <SheetTitle className="numeric text-base">{transactionId}</SheetTitle>
            {isDemo && <DemoTag />}
          </div>
          <SheetDescription>Transaction detail, model output and review status.</SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {query.isPending && transactionId !== null && <DrawerSkeleton />}
          {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
          {query.data && <DrawerBody t={query.data} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading transaction">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm text-foreground">{children}</dd>
    </div>
  );
}

function DrawerBody({ t }: { t: Transaction }) {
  const maxContribution = Math.max(0.0001, ...(t.explanation?.top_features ?? []).map((f) => Math.abs(f.contribution)));
  const pct = Math.round(t.fraud_probability * 100);
  const thresholdPct = Math.round(t.threshold * 100);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <PredictionBadge prediction={t.prediction} />
          <span className="numeric text-2xl font-semibold">{formatAmount(t.amount)}</span>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Fraud score {isDemo && "(fixture)"}</span>
            <span className="numeric text-foreground">{formatPercent(t.fraud_probability)}</span>
          </div>
          <div
            className="relative mt-1.5 h-2 rounded-full bg-muted"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label="Fraud score"
          >
            <div
              className={`h-full rounded-full ${t.prediction === "fraud" ? "bg-fraud" : "bg-legit"}`}
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute -top-1 h-4 w-px bg-foreground"
              style={{ left: `${thresholdPct}%` }}
              title={`Decision threshold ${t.threshold}`}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Marker = decision threshold ({t.threshold}). Scores are not calibrated probabilities.
          </p>
        </div>
      </div>

      <dl className="divide-y divide-border/70 rounded-lg border border-border bg-card px-4">
        <Row label="Timestamp">{formatDateTime(t.timestamp)}</Row>
        <Row label="Risk tier"><RiskBadge tier={t.risk_tier} /></Row>
        <Row label="Review status"><ReviewBadge status={t.review_status} /></Row>
        <Row label="Model version"><span className="numeric text-xs">{t.model_version}</span></Row>
        {t.label != null && <Row label="Ground-truth label">{t.label === 1 ? "Fraud (1)" : "Legitimate (0)"}</Row>}
        {t.analysis_job_id && <Row label="Analysis job"><span className="numeric text-xs">{t.analysis_job_id}</span></Row>}
      </dl>

      <div>
        <h3 className="text-sm font-semibold">Why this score?</h3>
        {t.explanation ? (
          <>
            <p className="mt-1 text-xs text-muted-foreground">
              Method: <span className="numeric">{t.explanation.method}</span>. {t.explanation.summary}
            </p>
            <ul className="mt-3 space-y-2">
              {t.explanation.top_features.map((f) => (
                <li key={f.feature} className="grid grid-cols-[3.5rem_1fr_4.5rem] items-center gap-3 text-xs">
                  <span className="numeric text-foreground">{f.feature}</span>
                  <span className="relative h-1.5 rounded-full bg-muted">
                    <span
                      className={`absolute inset-y-0 left-0 rounded-full ${f.contribution >= 0 ? "bg-fraud" : "bg-legit"}`}
                      style={{ width: `${(Math.abs(f.contribution) / maxContribution) * 100}%` }}
                    />
                  </span>
                  <span className="numeric text-right text-muted-foreground">
                    {f.contribution >= 0 ? "+" : ""}
                    {f.contribution.toFixed(3)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Coral pushes toward "fraud", teal toward "legitimate". V1–V28 are anonymized PCA components with no
              direct real-world meaning.
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">No explanation was returned for this transaction.</p>
        )}
      </div>

      {t.features && (
        <details className="group rounded-lg border border-border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Input features ({Object.keys(t.features).length})</summary>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-t border-border/70 px-4 py-3 sm:grid-cols-3">
            {Object.entries(t.features).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{k}</span>
                <span className="numeric">{v}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        Changing the review status needs a review endpoint, which API v0.1 doesn't include yet. It's on the roadmap
        (see docs/architecture.md).
      </p>
    </div>
  );
}