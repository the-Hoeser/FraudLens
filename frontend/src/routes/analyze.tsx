import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2, Send, X, XCircle } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { PredictionBadge, RiskBadge } from "@/components/common/badges";
import { PageHeader, Section } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/StateViews";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api/client";
import { isApiConfigured } from "@/lib/api/config";
import { csvIssuesFrom, describeError, isApiError } from "@/lib/api/errors";
import type { AnalysisJob } from "@/lib/api/types";
import { downloadTextFile, generateSampleCsv } from "@/lib/csv/sample";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_ROWS, validateCsvText, type CsvValidationResult } from "@/lib/csv/schema";
import { formatAmount, formatInt, formatPercent } from "@/lib/format";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "Analyze CSV — FraudLens AI" },
      {
        name: "description",
        content: "Upload a CSV in the anonymized credit-card schema, validate it, preview rows and submit it for model scoring.",
      },
      { property: "og:title", content: "Analyze CSV — FraudLens AI" },
      { property: "og:description", content: "Validate and submit transaction CSVs for fraud scoring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyzePage,
});

const configured = isApiConfigured();

function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<CsvValidationResult | null>(null);
  const [reading, setReading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    setJobId(null);
    setFile(f);
    setValidation(null);
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setValidation({ valid: false, headers: [], rowCount: 0, hasLabelColumn: false, preview: [], warnings: [], truncatedErrors: false, errors: [{ row: null, column: null, message: "Only .csv files are accepted." }] });
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setValidation({ valid: false, headers: [], rowCount: 0, hasLabelColumn: false, preview: [], warnings: [], truncatedErrors: false, errors: [{ row: null, column: null, message: `File is ${(f.size / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` }] });
      return;
    }
    setReading(true);
    try {
      const text = await f.text();
      setValidation(validateCsvText(text, f.size));
    } finally {
      setReading(false);
    }
  }, []);

  const reset = () => {
    setFile(null);
    setValidation(null);
    setJobId(null);
    submit.reset();
    if (inputRef.current) inputRef.current.value = "";
  };

  const submit = useMutation({
    mutationFn: (f: File) => apiClient.submitAnalysis(f),
    onSuccess: (res) => {
      setJobId(res.job_id);
      toast.success("Analysis job submitted", { description: `Job ${res.job_id} · ${formatInt(res.row_count)} rows` });
    },
  });

  const job = useQuery({
    queryKey: ["analysis-job", jobId],
    queryFn: () => apiClient.getAnalysisJob(jobId as string),
    enabled: jobId !== null,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "completed" || s === "failed" ? false : 1500;
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Investigate"
        title="Analyze a CSV"
        description="Validate a file in the anonymized ULB credit-card schema in your browser, preview it, then send it to the backend for scoring."
        actions={
          <Button variant="outline" onClick={() => downloadTextFile("fraudlens-synthetic-sample.csv", generateSampleCsv())}>
            <Download aria-hidden /> Sample CSV
          </Button>
        }
      />

      {!configured && (
        <div role="status" className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-hatch p-4 text-sm sm:flex-row sm:items-center">
          <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />
          <p className="flex-1 text-muted-foreground">
            <span className="font-medium text-foreground">Setup needed: no backend connected.</span> You can still validate and
            preview files here, but scoring is turned off — this page never invents predictions. Set{" "}
            <code className="numeric text-foreground">VITE_API_BASE_URL</code> to enable it.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/settings">Setup guide</Link>
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Privacy:</span> only upload anonymized feature data (Time, V1–V28, Amount,
        optional Class). Never upload names, card numbers, account IDs or other personal or payment data — files with extra
        columns are rejected.
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) void handleFile(f);
          }}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border bg-card"}`}
        >
          <div className="grid size-12 place-items-center rounded-full border border-border bg-surface text-primary">
            <FileUp className="size-5" aria-hidden />
          </div>
          <p className="mt-4 font-display text-base font-semibold">Drop a CSV here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB and {formatInt(MAX_UPLOAD_ROWS)} rows. Checked locally before anything is sent.
          </p>
          <label className="mt-5">
            <span className="sr-only">Choose a CSV file</span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="block text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </label>
        </div>

        <Section title="Expected schema" description="30 numeric features, any column order">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span className="numeric">Time</span><span className="text-muted-foreground">seconds, ≥ 0</span></li>
            <li className="flex justify-between"><span className="numeric">V1 … V28</span><span className="text-muted-foreground">PCA components</span></li>
            <li className="flex justify-between"><span className="numeric">Amount</span><span className="text-muted-foreground">≥ 0</span></li>
            <li className="flex justify-between"><span className="numeric">Class</span><span className="text-muted-foreground">optional, 0/1, ignored</span></li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">The sample CSV is synthetic random data in this schema — not real transactions.</p>
        </Section>
      </div>

      {(file || reading) && (
        <Section
          title={file ? file.name : "Reading file…"}
          description={file ? `${(file.size / 1024).toFixed(1)} KB` : undefined}
          actions={
            <Button variant="ghost" size="sm" onClick={reset} aria-label="Remove file">
              <X aria-hidden /> Clear
            </Button>
          }
        >
          {reading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Validating…
            </p>
          )}
          {validation && <ValidationReport v={validation} />}

          {validation?.valid && (
            <div className="mt-6 flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {configured
                  ? "File passed local checks. The server validates it again before scoring."
                  : "Scoring is unavailable until a backend is connected."}
              </p>
              <Button
                variant="signal"
                disabled={!configured || submit.isPending || jobId !== null}
                onClick={() => file && submit.mutate(file)}
              >
                {submit.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
                Submit for analysis
              </Button>
            </div>
          )}
          {submit.isError && <SubmitError error={submit.error} />}
        </Section>
      )}

      {jobId && (
        <Section title="Analysis job" description={<span className="numeric">{jobId}</span>}>
          {job.isError && <ErrorState error={job.error} onRetry={() => job.refetch()} />}
          {job.isPending && <p className="text-sm text-muted-foreground">Fetching job status…</p>}
          {job.data && <JobView job={job.data} />}
        </Section>
      )}
    </div>
  );
}

function ValidationReport({ v }: { v: CsvValidationResult }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {v.valid ? (
          <Badge variant="success"><CheckCircle2 className="size-3" aria-hidden /> Schema valid</Badge>
        ) : (
          <Badge variant="fraud"><XCircle className="size-3" aria-hidden /> {v.errors.length}{v.truncatedErrors ? "+" : ""} issue{v.errors.length === 1 ? "" : "s"}</Badge>
        )}
        <span className="text-sm text-muted-foreground">
          <span className="numeric text-foreground">{formatInt(v.rowCount)}</span> rows ·{" "}
          <span className="numeric text-foreground">{v.headers.length}</span> columns
        </span>
      </div>

      {v.errors.length > 0 && (
        <ul className="max-h-56 space-y-1 overflow-auto rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm" aria-label="Validation errors">
          {v.errors.map((e, i) => (
            <li key={i} className="flex gap-2">
              <span className="numeric shrink-0 text-xs text-destructive">
                {e.row !== null ? `row ${e.row}` : "file"}
                {e.column ? ` · ${e.column}` : ""}
              </span>
              <span className="text-foreground">{e.message}</span>
            </li>
          ))}
          {v.truncatedErrors && <li className="text-xs text-muted-foreground">More issues not shown.</li>}
        </ul>
      )}

      {v.warnings.map((w) => (
        <p key={w} className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden /> {w}
        </p>
      ))}

      {v.preview.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Preview · first {v.preview.length} rows</p>
          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="numeric text-xs">#</TableHead>
                  {v.headers.map((h) => (
                    <TableHead key={h} className="numeric whitespace-nowrap text-xs">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {v.preview.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="numeric text-xs text-muted-foreground">{i + 1}</TableCell>
                    {v.headers.map((h) => (
                      <TableCell key={h} className="numeric whitespace-nowrap text-xs">{row[h]}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

function SubmitError({ error }: { error: unknown }) {
  const issues = csvIssuesFrom(error);
  if (isApiError(error) && error.code === "model_not_available") {
    return (
      <div role="alert" className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-4 text-sm">
        <p className="font-medium text-foreground">No trained model on the backend</p>
        <p className="mt-1 text-muted-foreground">
          The file is valid, but the server has no model to score it with. Train one with{" "}
          <code className="numeric text-foreground">python -m app.ml.train --data data/creditcard.csv</code> (see docs/setup.md), then retry.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-4 space-y-2">
      <ErrorState error={error} title="Submission failed" />
      {issues.length > 0 && (
        <ul className="rounded-md border border-destructive/40 p-3 text-sm">
          {issues.map((e, i) => (
            <li key={i}>
              <span className="numeric text-xs text-destructive">{e.row !== null ? `row ${e.row}` : "file"}{e.column ? ` · ${e.column}` : ""}</span>{" "}
              {e.message}
            </li>
          ))}
        </ul>
      )}
      {!isApiError(error) && <p className="text-sm text-muted-foreground">{describeError(error)}</p>}
    </div>
  );
}

const STEPS: AnalysisJob["status"][] = ["queued", "running", "completed"];

function JobView({ job }: { job: AnalysisJob }) {
  const progress = job.row_count > 0 ? (job.processed_count / job.row_count) * 100 : 0;
  const stepIndex = job.status === "failed" ? -1 : STEPS.indexOf(job.status);

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Job progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <Badge variant={i < stepIndex || job.status === "completed" ? "success" : i === stepIndex ? "live" : "muted"}>{s}</Badge>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-border" aria-hidden />}
          </li>
        ))}
        {job.status === "failed" && <Badge variant="fraud">failed</Badge>}
      </ol>

      {job.status !== "failed" && (
        <div>
          <Progress value={progress} aria-label="Rows processed" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            <span className="numeric">{formatInt(job.processed_count)}</span> / <span className="numeric">{formatInt(job.row_count)}</span> rows
          </p>
        </div>
      )}

      {job.error && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <span className="numeric text-xs text-destructive">{job.error.code}</span> {job.error.message}
        </div>
      )}

      {job.summary && (
        <dl className="grid gap-3 sm:grid-cols-4">
          {[
            ["Flagged", formatInt(job.summary.flagged_count)],
            ["Flagged amount", formatAmount(job.summary.flagged_amount)],
            ["Flag rate", formatPercent(job.summary.fraud_rate, 2)],
            ["Model", job.model_version ?? "—"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md border border-border p-3">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="numeric mt-1 truncate text-sm text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {job.results && job.results.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            Prediction results{job.results.length < job.row_count ? ` · first ${job.results.length}` : ""} · threshold {job.threshold}
          </p>
          <div className="max-h-96 overflow-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Row</TableHead>
                  <TableHead className="text-xs">Transaction</TableHead>
                  <TableHead className="text-xs">Prediction</TableHead>
                  <TableHead className="text-right text-xs">Score</TableHead>
                  <TableHead className="text-xs">Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.results.map((r) => (
                  <TableRow key={r.row_index}>
                    <TableCell className="numeric text-xs">{r.row_index + 1}</TableCell>
                    <TableCell className="numeric text-xs">{r.transaction_id}</TableCell>
                    <TableCell><PredictionBadge prediction={r.prediction} /></TableCell>
                    <TableCell className="numeric text-right text-xs">{formatPercent(r.fraud_probability)}</TableCell>
                    <TableCell><RiskBadge tier={r.risk_tier} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Results are stored in the backend and appear in the{" "}
            <Link to="/transactions" className="text-primary hover:underline">Transactions explorer</Link>.
          </p>
        </div>
      )}
    </div>
  );
}