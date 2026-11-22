import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

import { ConfusionMatrixGrid } from "@/components/model/ConfusionMatrix";
import { PageHeader, Section } from "@/components/common/PageHeader";
import { BackendNotConfigured, EmptyState, ErrorState } from "@/components/common/StateViews";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { isApiConfigured } from "@/lib/api/config";
import type { EvaluatedMetrics } from "@/lib/api/types";
import { modelMetricsQuery } from "@/lib/data/source";
import { formatDateTime, formatInt, formatScore } from "@/lib/format";

export const Route = createFileRoute("/model")({
  head: () => ({
    meta: [
      { title: "Model performance — FraudLens AI" },
      {
        name: "description",
        content: "Precision, recall, F1, PR-AUC, ROC-AUC, confusion matrix and threshold trade-offs — shown only from real evaluation runs.",
      },
      { property: "og:title", content: "Model performance — FraudLens AI" },
      { property: "og:description", content: "Honest model evaluation metrics for fraud detection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ModelPage,
});

const GLOSSARY = [
  ["Precision", "Of the transactions flagged, how many were actually fraud. Low precision = many false alarms for reviewers."],
  ["Recall", "Of all actual fraud, how much was caught. Low recall = missed fraud."],
  ["F1", "Harmonic mean of precision and recall at the chosen threshold."],
  ["PR-AUC", "Area under the precision–recall curve (average precision). The most informative single number under heavy class imbalance; a random model scores roughly the fraud rate (~0.0017)."],
  ["ROC-AUC", "Probability a random fraud is scored above a random legit transaction. Often looks high on imbalanced data, so read it alongside PR-AUC."],
  ["Why not accuracy?", "With ~0.17% fraud, a model that never flags anything is 99.8% accurate and completely useless. Accuracy is never reported on its own here."],
] as const;

function ModelPage() {
  const configured = isApiConfigured();
  const query = useQuery(modelMetricsQuery());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Model"
        title="Model performance"
        description="Metrics appear only when the backend returns a real evaluation report. Nothing on this page is estimated or simulated."
      />

      {!configured ? (
        <NotEvaluated reason="No backend is connected, so there is no evaluation report to show." showSetup />
      ) : query.isPending ? (
        <div className="grid gap-4 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.status === "not_evaluated" ? (
        <NotEvaluated reason={query.data.reason} />
      ) : (
        <Evaluated m={query.data} />
      )}

      <Section title="How to read these metrics">
        <dl className="grid gap-4 md:grid-cols-2">
          {GLOSSARY.map(([term, def]) => (
            <div key={term}>
              <dt className="text-sm font-semibold text-foreground">{term}</dt>
              <dd className="mt-0.5 text-sm text-muted-foreground">{def}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}

function NotEvaluated({ reason, showSetup }: { reason: string; showSetup?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-5">
        {["Precision", "Recall", "F1", "PR-AUC", "ROC-AUC"].map((m) => (
          <div key={m} className="rounded-lg border border-dashed border-border bg-hatch-muted p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{m}</p>
            <p className="mt-2 font-mono text-sm text-muted-foreground">not evaluated</p>
          </div>
        ))}
      </div>
      {showSetup ? (
        <BackendNotConfigured feature="Model evaluation" />
      ) : (
        <EmptyState
          icon={<FlaskConical className="size-5" aria-hidden />}
          title="Model not evaluated yet"
          description={
            <>
              {reason} Train and evaluate with <code className="numeric text-foreground">python -m app.ml.train --data data/creditcard.csv</code>; the
              report is written by the pipeline and served here unchanged.
            </>
          }
        />
      )}
    </div>
  );
}

const curveConfig = {
  precision: { label: "Precision", color: "var(--chart-1)" },
  recall: { label: "Recall", color: "var(--chart-2)" },
  f1: { label: "F1", color: "var(--chart-4)" },
} satisfies ChartConfig;

function Evaluated({ m }: { m: EvaluatedMetrics }) {
  const curve = useMemo(() => [...m.threshold_curve].sort((a, b) => a.threshold - b.threshold), [m.threshold_curve]);
  const deployedIndex = useMemo(() => {
    let best = 0;
    curve.forEach((p, i) => {
      if (Math.abs(p.threshold - m.threshold) < Math.abs((curve[best]?.threshold ?? 0) - m.threshold)) best = i;
    });
    return best;
  }, [curve, m.threshold]);
  const [idx, setIdx] = useState(deployedIndex);
  const point = curve[idx];

  const cards = [
    ["Precision", m.metrics.precision],
    ["Recall", m.metrics.recall],
    ["F1", m.metrics.f1],
    ["PR-AUC", m.metrics.pr_auc],
    ["ROC-AUC", m.metrics.roc_auc],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="live">Evaluated</Badge>
        <span>Model <span className="numeric text-foreground">{m.model.version}</span></span>
        <span>· split <span className="numeric text-foreground">{m.split}</span></span>
        <span>· threshold <span className="numeric text-foreground">{m.threshold}</span></span>
        <span>· {formatDateTime(m.evaluated_at)}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        {cards.map(([label, v]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4 shadow-card">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="numeric mt-2 text-2xl font-semibold">{formatScore(v)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Confusion matrix" description={`Held-out ${m.split} split at the deployed threshold (${m.threshold})`}>
          <ConfusionMatrixGrid
            cm={m.confusion_matrix}
            caption={`Support: ${formatInt(m.metrics.support_positive)} fraud / ${formatInt(m.metrics.support_negative)} legitimate.`}
          />
        </Section>

        <Section title="Threshold explorer" description={`${m.threshold_curve_split} split — exploring does not change the deployed model`}>
          {!point ? (
            <p className="text-sm text-muted-foreground">The evaluation report contains no threshold curve.</p>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm">
                  <label htmlFor="threshold-slider">Decision threshold</label>
                  <span className="numeric text-foreground">{point.threshold.toFixed(3)}</span>
                </div>
                <Slider
                  id="threshold-slider"
                  className="mt-3"
                  min={0}
                  max={curve.length - 1}
                  step={1}
                  value={[idx]}
                  onValueChange={(v) => setIdx(v[0] ?? 0)}
                  aria-label="Decision threshold"
                />
                <button type="button" className="mt-2 text-xs text-primary hover:underline" onClick={() => setIdx(deployedIndex)}>
                  Reset to deployed threshold
                </button>
              </div>
              <dl className="grid grid-cols-3 gap-2">
                {(["precision", "recall", "f1"] as const).map((k) => (
                  <div key={k} className="rounded-md border border-border p-2.5">
                    <dt className="text-xs capitalize text-muted-foreground">{k}</dt>
                    <dd className="numeric text-lg">{formatScore(point[k])}</dd>
                  </div>
                ))}
              </dl>
              <ChartContainer config={curveConfig} className="aspect-auto h-48 w-full">
                <LineChart data={curve} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="threshold" type="number" domain={[0, 1]} tickLine={false} axisLine={false} tickFormatter={(v: number) => v.toFixed(1)} />
                  <YAxis domain={[0, 1]} tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => `Threshold ${Number(p?.[0]?.payload?.threshold ?? 0).toFixed(3)}`} />} />
                  <ReferenceLine x={point.threshold} stroke="var(--foreground)" strokeDasharray="4 4" />
                  <Line dataKey="precision" stroke="var(--color-precision)" dot={false} strokeWidth={2} />
                  <Line dataKey="recall" stroke="var(--color-recall)" dot={false} strokeWidth={2} />
                  <Line dataKey="f1" stroke="var(--color-f1)" dot={false} strokeWidth={2} />
                </LineChart>
              </ChartContainer>
              <ConfusionMatrixGrid cm={point} caption={`Confusion matrix on the ${m.threshold_curve_split} split at ${point.threshold.toFixed(3)}.`} />
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}