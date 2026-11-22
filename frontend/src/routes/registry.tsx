import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpenText, FlaskConical } from "lucide-react";

import { PageHeader, Section } from "@/components/common/PageHeader";
import { BackendNotConfigured, EmptyState, ErrorState } from "@/components/common/StateViews";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { isApiConfigured } from "@/lib/api/config";
import { modelInfoQuery } from "@/lib/data/source";
import { formatDateTime, formatInt, formatPercent } from "@/lib/format";

export const Route = createFileRoute("/registry")({
  head: () => ({
    meta: [
      { title: "Model registry — FraudLens AI" },
      { name: "description", content: "Inspect the model version, training dataset, feature schema and documented limitations." },
    ],
  }),
  component: RegistryPage,
});

function RegistryPage() {
  const configured = isApiConfigured();
  const query = useQuery(modelInfoQuery());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Model"
        title="Registry & about"
        description="Model metadata comes directly from the FastAPI service. No model cards or benchmark results are fabricated in the frontend."
      />
      {!configured ? (
        <BackendNotConfigured feature="Model registry" />
      ) : query.isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data && "status" in query.data && query.data.status === "not_trained" ? (
        <EmptyState
          icon={<FlaskConical className="size-5" aria-hidden />}
          title="No trained model registered"
          description={query.data.reason}
        />
      ) : query.data ? (
        <RegistryDetails model={query.data} />
      ) : null}
    </div>
  );
}

function RegistryDetails({ model }: { model: Exclude<Awaited<ReturnType<ReturnType<typeof modelInfoQuery>["queryFn"]>>, { status: "not_trained" }> }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="success">Trained</Badge>
        <span>Model version <span className="numeric text-foreground">{model.version}</span></span>
        <span>· {model.algorithm.replaceAll("_", " ")}</span>
        <span>· Trained {formatDateTime(model.trained_at)}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Training run" description="Metadata recorded with the trained artifact">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Run ID</dt><dd className="numeric text-right">{model.training_run_id}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Algorithm</dt><dd className="capitalize">{model.algorithm.replaceAll("_", " ")}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Decision threshold</dt><dd className="numeric">{model.threshold.toFixed(4)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Threshold selection</dt><dd className="max-w-[60%] text-right">{model.threshold_selection}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Imbalance handling</dt><dd className="max-w-[60%] text-right">{model.class_imbalance_strategy}</dd></div>
          </dl>
        </Section>

        <Section title="Training dataset" description={model.dataset.name}>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Rows</dt><dd className="numeric">{formatInt(model.dataset.rows)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Fraud prevalence</dt><dd className="numeric">{formatPercent(model.dataset.positive_rate * 100, 3)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">SHA-256</dt><dd className="numeric max-w-[65%] break-all text-right text-xs">{model.dataset.sha256 ?? "not recorded"}</dd></div>
            <a href={model.dataset.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Dataset source <BookOpenText className="size-3" aria-hidden />
            </a>
          </dl>
        </Section>
      </div>

      <Section title="Feature schema" description="Columns accepted for transaction scoring">
        <div className="flex flex-wrap gap-2">
          {model.feature_schema.map((feature) => (
            <span key={feature} className="rounded border border-border bg-muted px-2 py-1 font-mono text-xs">{feature}</span>
          ))}
        </div>
      </Section>

      <Section title="Model limitations" description="Read these before interpreting a model score">
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {model.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
        </ul>
      </Section>
    </>
  );
}
