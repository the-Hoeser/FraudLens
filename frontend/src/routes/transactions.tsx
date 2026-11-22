import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, RotateCcw, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { DemoTag, PredictionBadge, ReviewBadge, RiskBadge } from "@/components/common/badges";
import { PageHeader } from "@/components/common/PageHeader";
import { DemoBanner, EmptyState, ErrorState } from "@/components/common/StateViews";
import { TransactionDrawer } from "@/components/transactions/TransactionDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SortField, TransactionQuery } from "@/lib/api/types";
import { parseTransactionSearch } from "@/lib/data/search";
import { isDemo, transactionsQuery } from "@/lib/data/source";
import { DEFAULT_PAGE_SIZE } from "@/lib/demo/transforms";
import { formatAmount, formatDateTime, formatInt, formatPercent, REVIEW_LABELS, RISK_LABELS } from "@/lib/format";

export const Route = createFileRoute("/transactions")({
  validateSearch: (search: Record<string, unknown>): TransactionQuery => parseTransactionSearch(search),
  head: () => ({
    meta: [
      { title: "Transactions explorer — FraudLens AI" },
      {
        name: "description",
        content: "Search, filter and sort scored transactions, and inspect model explanations and review status.",
      },
      { property: "og:title", content: "Transactions explorer — FraudLens AI" },
      { property: "og:description", content: "Filter and inspect scored transactions with model explanations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TransactionsPage,
});

const ALL = "__all";

type QueryPatch = { [K in keyof TransactionQuery]?: TransactionQuery[K] | undefined };

function TransactionsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/transactions" });
  const [selected, setSelected] = useState<string | null>(null);
  const [qInput, setQInput] = useState(search.q ?? "");

  const update = (patch: QueryPatch, resetPage = true) => {
    void navigate({
      search: (prev: TransactionQuery) => {
        const next = { ...prev, ...patch } as TransactionQuery;
        if (resetPage) delete next.page;
        for (const k of Object.keys(next) as (keyof TransactionQuery)[]) {
          if (next[k] === undefined || next[k] === "") delete next[k];
        }
        return next;
      },
      replace: true,
    });
  };

  // Debounce the free-text search into the URL.
  useEffect(() => {
    const handle = setTimeout(() => {
      if ((search.q ?? "") !== qInput.trim()) update({ q: qInput.trim() || undefined });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  const query = useQuery(transactionsQuery(search));
  const data = query.data;
  const sortBy = search.sort_by ?? "timestamp";
  const sortDir = search.sort_dir ?? "desc";
  const hasFilters = Object.keys(search).some((k) => !["page", "page_size", "sort_by", "sort_dir"].includes(k));

  const toggleSort = (field: SortField) => {
    if (sortBy === field) update({ sort_by: field, sort_dir: sortDir === "desc" ? "asc" : "desc" });
    else update({ sort_by: field, sort_dir: "desc" });
  };

  const SortHeader = ({ field, children, align = "left" }: { field: SortField; children: React.ReactNode; align?: "left" | "right" }) => {
    const active = sortBy === field;
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className={align === "right" ? "text-right" : ""}>
        <button
          type="button"
          onClick={() => toggleSort(field)}
          className={`inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs uppercase tracking-wider hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "text-foreground" : ""}`}
        >
          {children}
          <Icon className="size-3" aria-hidden />
        </button>
      </TableHead>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Investigate"
        title="Transactions explorer"
        description="Every scored transaction with its prediction, risk tier, explanation and review status."
        actions={isDemo ? <DemoTag /> : undefined}
      />
      {isDemo && <DemoBanner />}

      <form
        className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-card md:grid-cols-2 xl:grid-cols-6"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Filter transactions"
      >
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="q">Search by ID</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="q" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="e.g. txn_0042" className="pl-8" maxLength={80} />
          </div>
        </div>
        <FilterSelect
          id="prediction"
          label="Prediction"
          value={search.prediction}
          options={[
            ["fraud", "Flagged"],
            ["legitimate", "Legitimate"],
          ]}
          onChange={(v) => update({ prediction: v as TransactionQuery["prediction"] })}
        />
        <FilterSelect
          id="risk"
          label="Risk tier"
          value={search.risk_tier}
          options={Object.entries(RISK_LABELS)}
          onChange={(v) => update({ risk_tier: v as TransactionQuery["risk_tier"] })}
        />
        <FilterSelect
          id="review"
          label="Review status"
          value={search.review_status}
          options={Object.entries(REVIEW_LABELS)}
          onChange={(v) => update({ review_status: v as TransactionQuery["review_status"] })}
        />
        <div className="flex items-end">
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={!hasFilters}
            onClick={() => {
              setQInput("");
              void navigate({ search: {}, replace: true });
            }}
          >
            <RotateCcw aria-hidden /> Reset filters
          </Button>
        </div>
        <NumberField id="min" label="Min amount" value={search.min_amount} onCommit={(v) => update({ min_amount: v })} />
        <NumberField id="max" label="Max amount" value={search.max_amount} onCommit={(v) => update({ max_amount: v })} />
        <div className="space-y-1.5">
          <Label htmlFor="from">From date</Label>
          <Input id="from" type="date" value={search.date_from ?? ""} onChange={(e) => update({ date_from: e.target.value || undefined })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To date</Label>
          <Input id="to" type="date" value={search.date_to ?? ""} min={search.date_from} onChange={(e) => update({ date_to: e.target.value || undefined })} />
        </div>
      </form>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 text-xs text-muted-foreground">
            <span aria-live="polite">
              {data ? `${formatInt(data.total)} transaction${data.total === 1 ? "" : "s"}` : "Loading…"}
              {query.isFetching && data ? " · updating" : ""}
            </span>
            <span>Times in UTC</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs uppercase tracking-wider">Transaction</TableHead>
                <SortHeader field="timestamp">Time</SortHeader>
                <SortHeader field="amount" align="right">Amount</SortHeader>
                <TableHead className="text-xs uppercase tracking-wider">Prediction</TableHead>
                <SortHeader field="fraud_probability" align="right">Score</SortHeader>
                <SortHeader field="risk_tier">Risk</SortHeader>
                <TableHead className="text-xs uppercase tracking-wider">Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isPending &&
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {data?.items.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(t.id)}
                >
                  <TableCell>
                    <button
                      type="button"
                      className="numeric rounded text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(t.id);
                      }}
                    >
                      {t.id}
                    </button>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(t.timestamp)}</TableCell>
                  <TableCell className="numeric text-right">{formatAmount(t.amount)}</TableCell>
                  <TableCell><PredictionBadge prediction={t.prediction} /></TableCell>
                  <TableCell className="numeric text-right">{formatPercent(t.fraud_probability)}</TableCell>
                  <TableCell><RiskBadge tier={t.risk_tier} /></TableCell>
                  <TableCell><ReviewBadge status={t.review_status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data && data.items.length === 0 && (
            <div className="p-6">
              <EmptyState
                title={hasFilters ? "No matches" : "No transactions yet"}
                description={hasFilters ? "Try widening the filters." : "Analyze a CSV to populate this list."}
              />
            </div>
          )}
          {data && data.total_pages > 1 && (
            <nav className="flex items-center justify-between border-t border-border/70 px-4 py-3" aria-label="Pagination">
              <span className="text-xs text-muted-foreground">
                Page <span className="numeric text-foreground">{data.page}</span> of{" "}
                <span className="numeric text-foreground">{data.total_pages}</span> · {search.page_size ?? DEFAULT_PAGE_SIZE} per page
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => update({ page: data.page - 1 }, false)}>
                  <ChevronLeft aria-hidden /> Previous
                </Button>
                <Button variant="outline" size="sm" disabled={data.page >= data.total_pages} onClick={() => update({ page: data.page + 1 }, false)}>
                  Next <ChevronRight aria-hidden />
                </Button>
              </div>
            </nav>
          )}
        </div>
      )}

      <TransactionDrawer transactionId={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string | undefined;
  options: [string, string][];
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onCommit,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
}) {
  const [local, setLocal] = useState(value?.toString() ?? "");
  useEffect(() => setLocal(value?.toString() ?? ""), [value]);
  const commit = () => {
    const n = local.trim() === "" ? undefined : Number(local);
    if (n === undefined || (Number.isFinite(n) && n >= 0)) {
      if (n !== value) onCommit(n);
    } else setLocal(value?.toString() ?? "");
  };
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        value={local}
        placeholder="Any"
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
    </div>
  );
}