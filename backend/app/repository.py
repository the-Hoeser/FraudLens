from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from .db import AnalysisJob, TransactionRecord


def job_to_dict(job: AnalysisJob) -> dict[str, Any]:
    return {
        "job_id": job.id, "status": job.status, "created_at": job.created_at.isoformat(),
        "updated_at": job.updated_at.isoformat(), "row_count": job.row_count,
        "processed_count": job.processed_count, "model_version": job.model_version,
        "threshold": job.threshold, "summary": job.summary, "results": job.results, "error": job.error,
    }


def transaction_to_dict(row: TransactionRecord, include_features: bool = False) -> dict[str, Any]:
    output = {
        "id": row.id, "timestamp": row.timestamp, "amount": row.amount, "time_offset_seconds": None,
        "prediction": row.prediction, "fraud_probability": row.fraud_probability, "risk_tier": row.risk_tier,
        "review_status": row.review_status, "model_version": row.model_version, "threshold": row.threshold,
        "analysis_job_id": row.analysis_job_id, "label": row.label, "explanation": row.explanation,
    }
    if include_features:
        output["features"] = row.features
    return output


def query_transactions(
    session: Session, *, page: int = 1, page_size: int = 25, q: str | None = None,
    prediction: str | None = None, risk_tier: str | None = None, review_status: str | None = None,
    min_amount: float | None = None, max_amount: float | None = None,
    date_from: date | None = None, date_to: date | None = None,
    sort_by: str = "timestamp", sort_dir: str = "desc",
) -> tuple[list[TransactionRecord], int]:
    stmt: Select[Any] = select(TransactionRecord)
    if q:
        stmt = stmt.where(TransactionRecord.id.ilike(f"%{q}%"))
    if prediction:
        stmt = stmt.where(TransactionRecord.prediction == prediction)
    if risk_tier:
        stmt = stmt.where(TransactionRecord.risk_tier == risk_tier)
    if review_status:
        stmt = stmt.where(TransactionRecord.review_status == review_status)
    if min_amount is not None:
        stmt = stmt.where(TransactionRecord.amount >= min_amount)
    if max_amount is not None:
        stmt = stmt.where(TransactionRecord.amount <= max_amount)
    if date_from:
        stmt = stmt.where(TransactionRecord.timestamp >= date_from.isoformat())
    if date_to:
        stmt = stmt.where(TransactionRecord.timestamp < f"{date_to.isoformat()}T23:59:59.999999+00:00")
    count = len(session.scalars(stmt).all())
    sortable = {
        "timestamp": TransactionRecord.timestamp, "amount": TransactionRecord.amount,
        "fraud_probability": TransactionRecord.fraud_probability, "risk_tier": TransactionRecord.risk_tier,
    }
    order = sortable[sort_by]
    stmt = stmt.order_by(order.asc() if sort_dir == "asc" else order.desc()).offset((page - 1) * page_size).limit(page_size)
    return list(session.scalars(stmt).all()), count


def dashboard_summary(session: Session, model_version: str | None) -> dict[str, Any]:
    rows = list(session.scalars(select(TransactionRecord).order_by(TransactionRecord.timestamp.desc())).all())
    total = len(rows)
    flagged = [row for row in rows if row.prediction == "fraud"]
    volume: dict[str, dict[str, int]] = {}
    risk_counts = {tier: 0 for tier in ("low", "medium", "high", "critical")}
    for row in rows:
        day = row.timestamp[:10]
        volume.setdefault(day, {"date": day, "total": 0, "flagged": 0})
        volume[day]["total"] += 1
        if row.prediction == "fraud":
            volume[day]["flagged"] += 1
        risk_counts[row.risk_tier] += 1
    return {
        "transactions_analyzed": total, "flagged_count": len(flagged),
        "review_queue_count": sum(1 for row in flagged if row.review_status in {"unreviewed", "in_review"}),
        "flagged_amount": float(sum(row.amount for row in flagged)),
        "volume_trend": [volume[key] for key in sorted(volume)][-30:],
        "class_breakdown": {"fraud": len(flagged), "legitimate": total - len(flagged)},
        "risk_distribution": [{"tier": tier, "count": count} for tier, count in risk_counts.items()],
        "recent_flagged": [transaction_to_dict(row) for row in flagged[:10]],
        "model_version": model_version,
    }
