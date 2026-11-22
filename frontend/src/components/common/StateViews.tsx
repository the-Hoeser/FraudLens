import { Link } from "@tanstack/react-router";
import { AlertTriangle, Inbox, PlugZap, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { describeError } from "@/lib/api/errors";

export function DemoBanner({ children }: { children?: ReactNode }) {
  return (
    <div
      role="note"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-warning/40 bg-hatch px-4 py-3 text-sm"
    >
      <span className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-warning">
        Demo data
      </span>
      <span className="text-muted-foreground">
        {children ??
          "No backend is connected, so this page shows generated fixtures for UI preview. Scores and labels are not model outputs."}
      </span>
      <Link to="/settings" className="text-primary underline-offset-4 hover:underline">
        Connect a backend
      </Link>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-hatch-muted px-6 py-12 text-center">
      <div className="grid size-10 place-items-center rounded-full border border-border bg-surface text-muted-foreground">
        {icon ?? <Inbox className="size-5" aria-hidden />}
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = "Couldn't load this data",
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-5 sm:flex-row sm:items-center">
      <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden />
      <div className="flex-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{describeError(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden /> Retry
        </Button>
      )}
    </div>
  );
}

export function BackendNotConfigured({ feature }: { feature: string }) {
  return (
    <EmptyState
      icon={<PlugZap className="size-5" aria-hidden />}
      title="Backend not connected"
      description={
        <>
          {feature} needs the FraudLens API. Set <code className="numeric text-foreground">VITE_API_BASE_URL</code> to
          your running backend (see <span className="text-foreground">docs/setup.md</span>). Nothing on this page is
          simulated.
        </>
      }
      action={
        <Button asChild variant="outline" size="sm">
          <Link to="/settings">Open settings & API status</Link>
        </Button>
      }
    />
  );
}