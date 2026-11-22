import type { Prediction, RiskTier } from "@/lib/api/types";

/**
 * Product convention shared with the backend (docs/api-contract.md).
 * Tiers are a display aid on top of an uncalibrated score, not a probability statement.
 */
export function riskTier(probability: number, threshold: number): RiskTier {
  if (probability >= Math.max(0.9, threshold)) return "critical";
  if (probability >= threshold) return "high";
  if (probability >= threshold / 2) return "medium";
  return "low";
}

export function predictionFor(probability: number, threshold: number): Prediction {
  return probability >= threshold ? "fraud" : "legitimate";
}

export const RISK_TIERS: readonly RiskTier[] = ["low", "medium", "high", "critical"];
export const RISK_ORDER: Record<RiskTier, number> = { low: 0, medium: 1, high: 2, critical: 3 };