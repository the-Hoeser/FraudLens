import type { ConfusionMatrix as CM } from "@/lib/api/types";
import { formatInt } from "@/lib/format";

export function ConfusionMatrixGrid({ cm, caption }: { cm: CM; caption: string }) {
  const cells = [
    { key: "tn", label: "True negative", hint: "Legit, predicted legit", value: cm.tn, tone: "border-legit/30 bg-legit/10 text-legit" },
    { key: "fp", label: "False positive", hint: "Legit, flagged", value: cm.fp, tone: "border-warning/30 bg-warning/10 text-warning" },
    { key: "fn", label: "False negative", hint: "Fraud, missed", value: cm.fn, tone: "border-fraud/40 bg-fraud/10 text-fraud" },
    { key: "tp", label: "True positive", hint: "Fraud, flagged", value: cm.tp, tone: "border-primary/40 bg-primary/10 text-primary" },
  ];
  return (
    <figure>
      <div className="grid grid-cols-[auto_1fr_1fr] gap-2 text-xs">
        <span />
        <span className="text-center uppercase tracking-wider text-muted-foreground">Pred. legit</span>
        <span className="text-center uppercase tracking-wider text-muted-foreground">Pred. fraud</span>
        <span className="self-center uppercase tracking-wider text-muted-foreground [writing-mode:vertical-rl] rotate-180">Actual legit</span>
        {cells.slice(0, 2).map(({ key, ...c }) => <Cell key={key} {...c} />)}
        <span className="self-center uppercase tracking-wider text-muted-foreground [writing-mode:vertical-rl] rotate-180">Actual fraud</span>
        {cells.slice(2).map(({ key, ...c }) => <Cell key={key} {...c} />)}
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}

function Cell({ label, hint, value, tone }: { label: string; hint: string; value: number; tone: string }) {
  return (
    <div className={`rounded-md border p-3 ${tone}`}>
      <p className="numeric text-2xl font-semibold">{formatInt(value)}</p>
      <p className="mt-1 text-xs font-medium text-foreground">{label}</p>
      <p className="text-[0.7rem] text-muted-foreground">{hint}</p>
    </div>
  );
}