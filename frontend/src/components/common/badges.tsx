import { Badge } from "@/components/ui/badge";
import type { Prediction, ReviewStatus, RiskTier } from "@/lib/api/types";
import { REVIEW_LABELS, RISK_LABELS } from "@/lib/format";

export function DemoTag({ label = "Demo data" }: { label?: string }) {
  return (
    <Badge variant="demo" title="Generated fixture for UI preview — not real data and not a model output">
      {label}
    </Badge>
  );
}

export function PredictionBadge({ prediction }: { prediction: Prediction }) {
  return (
    <Badge variant={prediction === "fraud" ? "fraud" : "legit"}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {prediction === "fraud" ? "Flagged" : "Legitimate"}
    </Badge>
  );
}

export function RiskBadge({ tier }: { tier: RiskTier }) {
  return <Badge variant={`risk-${tier}`}>{RISK_LABELS[tier]}</Badge>;
}

const reviewVariant: Record<ReviewStatus, "muted" | "warning" | "fraud" | "success"> = {
  unreviewed: "muted",
  in_review: "warning",
  confirmed_fraud: "fraud",
  cleared: "success",
};

export function ReviewBadge({ status }: { status: ReviewStatus }) {
  return <Badge variant={reviewVariant[status]}>{REVIEW_LABELS[status]}</Badge>;
}