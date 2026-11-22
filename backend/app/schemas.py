from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field

Prediction = Literal["fraud", "legitimate"]
RiskTier = Literal["low", "medium", "high", "critical"]
ReviewStatus = Literal["unreviewed", "in_review", "confirmed_fraud", "cleared"]


class ErrorBody(BaseModel):
    code: str
    message: str
    details: Any | None = None


class ErrorEnvelope(BaseModel):
    error: ErrorBody


class Health(BaseModel):
    status: str
    version: str
    model_loaded: bool
    model_version: str | None
    database: Literal["not_configured", "connected", "error"]
    database_provider: Literal["postgresql", "sqlite", "unknown"] = "unknown"
    timestamp: str


class TopFeature(BaseModel):
    feature: str
    value: float
    contribution: float


class Explanation(BaseModel):
    method: str
    summary: str
    top_features: list[TopFeature]


class Transaction(BaseModel):
    id: str
    timestamp: str
    amount: float
    time_offset_seconds: float | None = None
    prediction: Prediction
    fraud_probability: float = Field(ge=0, le=1)
    risk_tier: RiskTier
    review_status: ReviewStatus
    model_version: str
    threshold: float
    analysis_job_id: str | None = None
    label: int | None = None
    explanation: Explanation | None = None
    features: dict[str, float] | None = None


class DashboardSummary(BaseModel):
    transactions_analyzed: int
    flagged_count: int
    review_queue_count: int
    flagged_amount: float
    volume_trend: list[dict[str, Any]]
    class_breakdown: dict[str, int]
    risk_distribution: list[dict[str, Any]]
    recent_flagged: list[Transaction]
    model_version: str | None
    generated_at: str


class TransactionPage(BaseModel):
    items: list[Transaction]
    page: int
    page_size: int
    total: int
    total_pages: int


class AnalyzeAccepted(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "failed"]
    row_count: int
    created_at: str


class PredictionResult(BaseModel):
    prediction: Prediction
    fraud_probability: float = Field(ge=0, le=1)
    risk_tier: RiskTier


class AnalysisJob(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "failed"]
    created_at: str
    updated_at: str
    row_count: int
    processed_count: int
    model_version: str | None
    threshold: float | None
    summary: dict[str, Any] | None
    results: list[dict[str, Any]] | None
    error: dict[str, str] | None


class PredictRequest(BaseModel):
    transactions: list[dict[str, float]] = Field(min_length=1, max_length=1000)
