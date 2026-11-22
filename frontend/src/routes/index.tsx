import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CircleDollarSign, ClipboardList, ScanLine, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { DemoTag, PredictionBadge, ReviewBadge, RiskBadge } from "@/components/common/badges";
import { KpiCard } from "@/components/common/KpiCard";
import { PageHeader, Section } from "@/components/common/PageHeader";
import { DemoBanner, EmptyState, ErrorState } from "@/components/common/StateViews";
import { TransactionDrawer } from "@/components/transactions/TransactionDrawer";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardQuery, isDemo } from "@/lib/data/source";
import { formatAmount, formatCompactAmount, formatDateTime, formatDay, formatInt, formatPercent, RISK_LABELS } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — FraudLens AI" },
      {
        name: "description",
        content: "Overview of analyzed transactions, flagged activity, review queue and risk distribution in FraudLens AI.",
      },
      { property: "og:title", content: "Dashboard — FraudLens AI" },
      { property: "og:description", content: "Fraud detection analytics overview for learning and experimentation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const volumeConfig = {
  total: { label: "All transactions", color: "var(--chart-1)" },
  flagged: { label: "Flagged", color: "var(--chart-3)" },
} satisfies ChartConfig;

const classConfig = {
  legitimate: { label: "Legitimate", color: "var(--legit)" },
  fraud: { label: "Flagged", color: "var(--fraud)" },
} satisfies ChartConfig;

const riskConfig = {
  count: { label: "Transactions" },
  low: { label: "Low", color: "var(--risk-low)" },
  medium: { label: "Medium", color: "var(--risk-medium)" },
  high: { label: "High", color: "var(--risk-high)" },
  critical: { label: "Critical", color: "var(--risk-critical)" },
} satisfies ChartConfig;

function Dashboard() {
  const query = useQuery(dashboardQuery());
  const [selected, setSelected] = useState<string | null>(null);
  const data = query.data;
  const loading = query.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Fraud monitoring dashboard"
        description="Activity across transactions scored by the model, with what's waiting for human review."
        actions={
          <Button asChild variant="signal">
            <Link to="/analyze">
              Analyze a CSV <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />

      {isDemo && <DemoBanner />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}

      {!query.isError && data && data.transactions_analyzed === 0 ? (
        <EmptyState
          title="No transactions analyzed yet"
          description="Upload a CSV in the Analyze page once a trained model is loaded on the backend. Results will appear here."
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/analyze">Go to Analyze</Link>
            </Button>
          }
        />
      ) : (
        !query.isError && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Transactions analyzed"
                value={data ? formatInt(data.transactions_analyzed) : "—"}
                hint={isDemo ? "Demo fixtures" : "Scored by the model"}
                icon={ScanLine}
                loading={loading}
              />
              <KpiCard
                label="Flagged"
                value={data ? formatInt(data.flagged_count) : "—"}
                hint={
                  data && data.transactions_analyzed > 0
                    ? `${formatPercent(data.flagged_count / data.transactions_analyzed, 2)} of analyzed`
                    : undefined
                }
                icon={ShieldAlert}
                tone="fraud"
                loading={loading}
              />
              <KpiCard
                label="Review queue"
                value={data ? formatInt(data.review_queue_count) : "—"}
                hint="Flagged, unreviewed or in review"
                icon={ClipboardList}
                tone="warning"
                loading={loading}
              />
              <KpiCard
                label="Flagged amount"
                value={data ? formatCompactAmount(data.flagged_amount) : "—"}
                hint={data ? formatAmount(data.flagged_amount) : undefined}
                icon={CircleDollarSign}
                tone="signal"
                loading={loading}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Section
                title="Transaction volume"
                description="Daily transactions vs. flagged (UTC)"
                className="lg:col-span-2"
                actions={isDemo ? <DemoTag /> : undefined}
              >
                {loading || !data ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ChartContainer config={volumeConfig} className="aspect-auto h-64 w-full">
                    <AreaChart data={data.volume_trend} margin={{ left: 0, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-total)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--color-total)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={formatDay} minTickGap={24} />
                      <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => formatDay(String(v))} />} />
                      <Area dataKey="total" type="monotone" stroke="var(--color-total)" fill="url(#fillTotal)" strokeWidth={2} />
                      <Area dataKey="flagged" type="monotone" stroke="var(--color-flagged)" fill="var(--color-flagged)" fillOpacity={0.15} strokeWidth={2} />
                    </AreaChart>
                  </ChartContainer>
                )}
              </Section>

              <Section title="Flagged vs legitimate" description="Model decision at the current threshold" actions={isDemo ? <DemoTag /> : undefined}>
                {loading || !data ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <div>
                    <ChartContainer config={classConfig} className="mx-auto aspect-square h-48">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
                        <Pie
                          data={[
                            { key: "legitimate", value: data.class_breakdown.legitimate },
                            { key: "fraud", value: data.class_breakdown.fraud },
                          ]}
                          dataKey="value"
                          nameKey="key"
                          innerRadius={52}
                          outerRadius={80}
                          strokeWidth={2}
                          stroke="var(--card)"
                        >
                          <Cell fill="var(--color-legitimate)" />
                          <Cell fill="var(--color-fraud)" />
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-md border border-border p-2.5">
                        <dt className="text-xs text-muted-foreground">Legitimate</dt>
                        <dd className="numeric text-legit">{formatInt(data.class_breakdown.legitimate)}</dd>
                      </div>
                      <div className="rounded-md border border-border p-2.5">
                        <dt className="text-xs text-muted-foreground">Flagged</dt>
                        <dd className="numeric text-fraud">{formatInt(data.class_breakdown.fraud)}</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </Section>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Section title="Risk distribution" description="Tier = score relative to threshold" actions={isDemo ? <DemoTag /> : undefined}>
                {loading || !data ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <ChartContainer config={riskConfig} className="aspect-auto h-56 w-full">
                    <BarChart data={data.risk_distribution.map((r) => ({ ...r, label: RISK_LABELS[r.tier] }))} margin={{ left: 0, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={32} scale="sqrt" allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {data.risk_distribution.map((r) => (
                          <Cell key={r.tier} fill={`var(--color-${r.tier})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                )}
                <p className="mt-2 text-xs text-muted-foreground">Square-root scale so rare high-risk tiers stay visible.</p>
              </Section>

              <Section
                title="Recent flagged transactions"
                description="Newest first — select one for details"
                className="lg:col-span-2"
                actions={
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/transactions">
                      View all <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                }
              >
                {loading || !data ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 w-full" />
                    ))}
                  </div>
                ) : data.recent_flagged.length === 0 ? (
                  <EmptyState title="Nothing flagged" description="No transaction crossed the decision threshold." />
                ) : (
                  <ul className="divide-y divide-border/70">
                    {data.recent_flagged.slice(0, 6).map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(t.id)}
                          className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[1.4fr_1fr_auto_auto_auto]"
                        >
                          <span>
                            <span className="numeric block text-sm text-foreground">{t.id}</span>
                            <span className="text-xs text-muted-foreground">{formatDateTime(t.timestamp)}</span>
                          </span>
                          <span className="numeric text-right text-sm sm:text-left">{formatAmount(t.amount)}</span>
                          <span className="hidden sm:block"><PredictionBadge prediction={t.prediction} /></span>
                          <span className="hidden sm:block"><RiskBadge tier={t.risk_tier} /></span>
                          <span className="hidden sm:block"><ReviewBadge status={t.review_status} /></span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>

            {data && (
              <p className="text-xs text-muted-foreground">
                Model version: <span className="numeric">{data.model_version ?? "none"}</span> · Generated{" "}
                {formatDateTime(data.generated_at)}
              </p>
            )}
          </>
        )
      )}

      <TransactionDrawer transactionId={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}