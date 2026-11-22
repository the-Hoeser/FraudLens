import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, Database, ExternalLink, RefreshCw, Server } from "lucide-react";

import { PageHeader, Section } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/StateViews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiBaseUrl, isApiConfigured } from "@/lib/api/config";
import { healthQuery } from "@/lib/data/source";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings & API — FraudLens AI" },
      { name: "description", content: "Inspect the configured FraudLens API, database connection and model availability." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const configured = isApiConfigured();
  const apiBase = getApiBaseUrl();
  const query = useQuery(healthQuery());
  const health = query.data?.data;
  const databaseLabel =
    health?.database_provider === "postgresql"
      ? "PostgreSQL (Supabase)"
      : health?.database_provider === "sqlite"
        ? "SQLite local fallback"
        : health?.database_provider === "unknown"
          ? "Unknown database"
          : "Not reported";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System"
        title="Settings & API"
        description="Connection diagnostics for the FastAPI service and its server-side database connection."
        actions={
          configured ? (
            <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RefreshCw className={query.isFetching ? "animate-spin" : ""} aria-hidden />
              Refresh status
            </Button>
          ) : undefined
        }
      />

      {!configured ? (
        <Section title="Backend not configured" description="The production frontend must point to the separately deployed FastAPI service.">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Set <code className="numeric text-foreground">VITE_API_BASE_URL</code> in Vercel → Project Settings → Environment Variables
              to the HTTPS origin of the FraudLens API, then redeploy the frontend.
            </p>
            <p>
              For local development, copy <code className="numeric text-foreground">.env.example</code> to <code className="numeric text-foreground">.env</code>
              and use <code className="numeric text-foreground">http://localhost:8000</code>.
            </p>
            <p>Do not add database passwords or Supabase service-role keys to frontend environment variables.</p>
          </div>
        </Section>
      ) : query.isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} title="Could not reach the FraudLens API" onRetry={() => void query.refetch()} />
      ) : health ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Section
              title="API service"
              description="Direct browser-to-FastAPI connection"
              actions={<Badge variant={health.status === "ok" ? "success" : "warning"}>{health.status}</Badge>}
            >
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Server className="size-4" aria-hidden /> API origin</div>
                <code className="block break-all rounded-md bg-muted p-2 text-xs text-foreground">{apiBase}</code>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">API version</span>
                  <span className="numeric">{health.version}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last checked</span>
                  <span className="numeric">{formatDateTime(health.timestamp)}</span>
                </div>
                <a className="inline-flex items-center gap-1 text-primary hover:underline" href={apiBase + "/docs"} target="_blank" rel="noreferrer">
                  Open interactive API docs <ExternalLink className="size-3" aria-hidden />
                </a>
              </div>
            </Section>

            <Section title="Database connection" description="Database credentials remain on the API server">
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Database className="size-4" aria-hidden /> Persistence status</div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Connection</span>
                  <Badge variant={health.database === "connected" ? "success" : "fraud"}>{health.database}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="text-right">{databaseLabel}</span>
                </div>
                {health.database_provider === "sqlite" && (
                  <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
                    The API is using SQLite. Configure the server-side DATABASE_URL with the Supabase PostgreSQL connection string for persistent production data.
                  </p>
                )}
                {health.database_provider === "postgresql" && (
                  <p className="rounded-md border border-signal/40 bg-signal/10 p-3 text-xs text-signal">
                    The API is connected to PostgreSQL. Supabase credentials are not exposed to this browser.
                  </p>
                )}
              </div>
            </Section>
          </div>

          <Section title="Model availability" description="The API must have trained artifacts before CSV scoring can run">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Activity className="size-4 text-muted-foreground" aria-hidden />
              <Badge variant={health.model_loaded ? "success" : "warning"}>{health.model_loaded ? "Model loaded" : "No trained model loaded"}</Badge>
              <span className="text-muted-foreground">Version</span>
              <span className="numeric">{health.model_version ?? "not trained"}</span>
            </div>
            {!health.model_loaded && (
              <p className="mt-3 text-sm text-muted-foreground">
                Train and evaluate the benchmark on the backend host, then redeploy or reload the model. The Analyze page will refuse scoring while no trained model is available.
              </p>
            )}
          </Section>
        </>
      ) : null}
    </div>
  );
}
