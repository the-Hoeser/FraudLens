import { FEATURE_COLUMNS, type ReviewStatus, type Transaction } from "@/lib/api/types";
import { predictionFor, riskTier } from "@/lib/risk";

import { mulberry32, normal } from "./prng";

/**
 * DEMO FIXTURES — for UI preview only.
 * These records are randomly generated. Their "scores" are NOT model outputs and their
 * fraud share is deliberately inflated so charts have something to show.
 */
export const DEMO_MODEL_VERSION = "demo-fixture (not a model)";
export const DEMO_THRESHOLD = 0.5;
export const DEMO_END_DATE = "2026-11-15T23:59:59Z";
export const DEMO_DAYS = 30;
export const DEMO_COUNT = 420;

function round(n: number, digits = 2) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function generateDemoTransactions(count = DEMO_COUNT, seed = 20131): Transaction[] {
  const rand = mulberry32(seed);
  const end = Date.parse(DEMO_END_DATE);
  const span = DEMO_DAYS * 24 * 3600 * 1000;
  const out: Transaction[] = [];

  for (let i = 0; i < count; i++) {
    const suspicious = rand() < 0.045;
    const score = suspicious
      ? Math.min(0.995, 0.45 + rand() * 0.55)
      : Math.min(0.6, Math.abs(normal(rand)) * 0.08);
    const probability = round(score, 4);
    const prediction = predictionFor(probability, DEMO_THRESHOLD);
    const tier = riskTier(probability, DEMO_THRESHOLD);
    const ts = new Date(end - Math.floor(rand() * span));
    const amount = round(Math.exp(3 + normal(rand) * 1.3), 2);

    let review: ReviewStatus = "unreviewed";
    if (prediction === "fraud") {
      const r = rand();
      review = r < 0.4 ? "unreviewed" : r < 0.65 ? "in_review" : r < 0.85 ? "confirmed_fraud" : "cleared";
    } else if (rand() < 0.02) {
      review = "cleared";
    }

    const features: Record<string, number> = {};
    for (const col of FEATURE_COLUMNS) {
      if (col === "Time") features[col] = round((ts.getTime() - (end - span)) / 1000, 0);
      else if (col === "Amount") features[col] = amount;
      else features[col] = round(normal(rand) * (suspicious ? 2.2 : 1), 4);
    }

    const top = ["V14", "V17", "V12", "V10", "V4", "V11"]
      .map((f) => ({ feature: f, value: features[f] ?? 0, contribution: round((rand() - 0.3) * 0.4, 3) }))
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 4);

    out.push({
      id: `demo_txn_${String(i + 1).padStart(4, "0")}`,
      timestamp: ts.toISOString().replace(/\.\d{3}Z$/, "Z"),
      amount,
      time_offset_seconds: features["Time"] ?? null,
      prediction,
      fraud_probability: probability,
      risk_tier: tier,
      review_status: review,
      model_version: DEMO_MODEL_VERSION,
      threshold: DEMO_THRESHOLD,
      analysis_job_id: null,
      label: null,
      explanation: {
        method: "demo_fixture",
        summary:
          "Illustrative placeholder. Demo records have no model behind them; real explanations come from the trained model's attributions.",
        top_features: top,
      },
      features,
    });
  }
  return out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

let cache: Transaction[] | null = null;
export function demoTransactions(): Transaction[] {
  cache ??= generateDemoTransactions();
  return cache;
}