from __future__ import annotations

import logging
import math
import os
import tempfile
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import APP_VERSION, FEATURE_COLUMNS, MAX_UPLOAD_BYTES, cors_origin_regex, cors_origins
from .db import AnalysisJob, TransactionRecord, get_database
from .ml.inference import ModelBundle
from .repository import dashboard_summary, job_to_dict, query_transactions, transaction_to_dict
from .schemas import AnalysisJob as AnalysisJobSchema
from .schemas import DashboardSummary, Health, PredictRequest, Transaction, TransactionPage
from .services.csv_validation import validate_csv_file

logger = logging.getLogger("fraudlens.api")
model_bundle = ModelBundle()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def db_session():
    return get_database().Session()


def api_error(status_code: int, code: str, message: str, details: Any = None) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"error": {"code": code, "message": message, "details": details}})


@asynccontextmanager
async def lifespan(application: FastAPI):
    get_database().initialize()
    model_bundle.reload()
    yield


app = FastAPI(
    title="FraudLens AI API",
    version=APP_VERSION,
    description="Educational financial transaction fraud detection API. Not for production payment decisions.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_origin_regex=cors_origin_regex(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization", "X-Request-ID"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    content = exc.detail if isinstance(exc.detail, dict) and "error" in exc.detail else {
        "error": {"code": "http_error", "message": str(exc.detail), "details": None}
    }
    return JSONResponse(status_code=exc.status_code, content=content, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "validation_error", "message": "Request validation failed.", "details": exc.errors()}},
    )


@app.get("/health", response_model=Health)
def health():
    database_provider = "unknown"
    try:
        database = get_database()
        dialect = database.engine.dialect.name
        if dialect in {"postgresql", "sqlite"}:
            database_provider = dialect
        database_state = "connected" if database.check() else "error"
    except Exception:
        database_state = "error"
    return {
        "status": "ok", "version": APP_VERSION, "model_loaded": model_bundle.is_loaded,
        "model_version": model_bundle.version, "database": database_state,
        "database_provider": database_provider, "timestamp": now_iso(),
    }


@app.get("/api/dashboard/summary", response_model=DashboardSummary)
def get_dashboard_summary():
    with db_session() as session:
        result = dashboard_summary(session, model_bundle.version)
        result["generated_at"] = now_iso()
        return result


@app.get("/api/transactions", response_model=TransactionPage)
def list_transactions(
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100), q: str | None = None,
    prediction: str | None = Query(None, pattern="^(fraud|legitimate)$"),
    risk_tier: str | None = Query(None, pattern="^(low|medium|high|critical)$"),
    review_status: str | None = Query(None, pattern="^(unreviewed|in_review|confirmed_fraud|cleared)$"),
    min_amount: float | None = Query(None, ge=0), max_amount: float | None = Query(None, ge=0),
    date_from: date | None = None, date_to: date | None = None,
    sort_by: str = Query("timestamp", pattern="^(timestamp|amount|fraud_probability|risk_tier)$"),
    sort_dir: str = Query("desc", pattern="^(asc|desc)$"),
):
    if min_amount is not None and max_amount is not None and min_amount > max_amount:
        raise api_error(422, "validation_error", "min_amount must be <= max_amount")
    if date_from and date_to and date_from > date_to:
        raise api_error(422, "validation_error", "date_from must be <= date_to")
    with db_session() as session:
        records, total = query_transactions(
            session, page=page, page_size=page_size, q=q, prediction=prediction, risk_tier=risk_tier,
            review_status=review_status, min_amount=min_amount, max_amount=max_amount,
            date_from=date_from, date_to=date_to, sort_by=sort_by, sort_dir=sort_dir,
        )
        return {
            "items": [transaction_to_dict(row) for row in records], "page": page, "page_size": page_size,
            "total": total, "total_pages": math.ceil(total / page_size) if total else 0,
        }


@app.get("/api/transactions/{transaction_id}", response_model=Transaction)
def get_transaction(transaction_id: str):
    with db_session() as session:
        row = session.get(TransactionRecord, transaction_id)
        if row is None:
            raise api_error(404, "not_found", "Transaction was not found.")
        output = transaction_to_dict(row, include_features=True)
        output["time_offset_seconds"] = None
        return output


def risk_tier(probability: float, threshold: float) -> str:
    if probability >= max(0.9, threshold):
        return "critical"
    if probability >= threshold:
        return "high"
    if probability >= threshold / 2:
        return "medium"
    return "low"


def create_transaction_dict(index: int, row: pd.Series, probability: float, job_id: str) -> dict[str, Any]:
    threshold = model_bundle.threshold
    prediction = "fraud" if probability >= threshold else "legitimate"
    time_offset = float(row["Time"])
    base = datetime(2013, 9, 30, tzinfo=timezone.utc)
    timestamp = (base + timedelta(seconds=time_offset)).isoformat()
    return {
        "id": f"txn_{job_id[-8:]}_{index:06d}", "timestamp": timestamp, "amount": float(row["Amount"]),
        "prediction": prediction, "fraud_probability": float(probability), "risk_tier": risk_tier(float(probability), threshold),
        "review_status": "unreviewed" if prediction == "fraud" else "cleared",
        "model_version": model_bundle.version or "unknown", "threshold": threshold, "analysis_job_id": job_id,
        "label": int(row["Class"]) if "Class" in row and pd.notna(row["Class"]) else None,
        "explanation": model_bundle.explain(row) if prediction == "fraud" else None,
        "features": {name: float(row[name]) for name in FEATURE_COLUMNS} if prediction == "fraud" else None,
    }


def process_analysis(job_id: str, frame: pd.DataFrame) -> None:
    with db_session() as session:
        job = session.get(AnalysisJob, job_id)
        if job is None:
            return
        job.status = "running"
        job.updated_at = datetime.now(timezone.utc)
        session.commit()

    try:
        probabilities = model_bundle.predict_proba(frame)
        total_rows = len(frame)
        flagged_count = 0
        flagged_amount = 0.0
        result_preview: list[dict[str, Any]] = []
        batch_size = 2_000
        for start in range(0, total_rows, batch_size):
            stop = min(start + batch_size, total_rows)
            records: list[TransactionRecord] = []
            for offset in range(start, stop):
                row = frame.iloc[offset]
                item = create_transaction_dict(offset, row, float(probabilities[offset]), job_id)
                if item["prediction"] == "fraud":
                    flagged_count += 1
                    flagged_amount += item["amount"]
                if offset < 500:
                    result_preview.append({
                        "row_index": offset, "transaction_id": item["id"], "prediction": item["prediction"],
                        "fraud_probability": item["fraud_probability"], "risk_tier": item["risk_tier"],
                    })
                records.append(TransactionRecord(
                    id=item["id"], timestamp=item["timestamp"], amount=item["amount"], prediction=item["prediction"],
                    fraud_probability=item["fraud_probability"], risk_tier=item["risk_tier"],
                    review_status=item["review_status"], model_version=item["model_version"], threshold=item["threshold"],
                    analysis_job_id=job_id, label=item["label"], explanation=item["explanation"],
                    features=item["features"] if item["prediction"] == "fraud" else None,
                ))
            with db_session() as session:
                session.add_all(records)
                job = session.get(AnalysisJob, job_id)
                job.processed_count = stop
                job.updated_at = datetime.now(timezone.utc)
                session.commit()

        with db_session() as session:
            job = session.get(AnalysisJob, job_id)
            job.status = "completed"
            job.processed_count = total_rows
            job.updated_at = datetime.now(timezone.utc)
            job.model_version = model_bundle.version
            job.threshold = model_bundle.threshold
            job.summary = {
                "flagged_count": flagged_count, "flagged_amount": float(flagged_amount),
                "fraud_rate": flagged_count / total_rows if total_rows else 0.0,
            }
            job.results = result_preview
            session.commit()
    except Exception:
        logger.exception("Analysis job %s failed", job_id)
        from sqlalchemy import delete
        with db_session() as session:
            session.execute(delete(TransactionRecord).where(TransactionRecord.analysis_job_id == job_id))
            job = session.get(AnalysisJob, job_id)
            if job:
                job.status = "failed"
                job.processed_count = 0
                job.updated_at = datetime.now(timezone.utc)
                job.error = {"code": "analysis_failed", "message": "Analysis failed. Check backend logs for details."}
                session.commit()


@app.post("/api/analyze", status_code=202)
async def analyze_csv(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise api_error(422, "csv_invalid", "Upload a .csv file.")

    temp_path = None
    byte_count = 0
    try:
        with tempfile.NamedTemporaryFile(prefix="fraudlens-upload-", suffix=".csv", delete=False) as target:
            temp_path = target.name
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                byte_count += len(chunk)
                if byte_count > MAX_UPLOAD_BYTES:
                    raise api_error(413, "file_too_large", f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MiB upload limit.")
                target.write(chunk)
        result = validate_csv_file(Path(temp_path))
    finally:
        await file.close()
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

    if not result.valid or result.frame is None:
        status = 413 if any("larger than" in item.message.lower() or "too many rows" in item.message.lower() for item in result.errors) else 422
        code = "file_too_large" if status == 413 else "csv_invalid"
        raise api_error(status, code, "CSV validation failed.", {"errors": result.public_errors()})
    if not model_bundle.is_loaded:
        raise api_error(503, "model_not_available", "No trained model is loaded. Train the model before submitting analyses.")

    job_id = f"job_{uuid.uuid4().hex}"
    created = datetime.now(timezone.utc)
    with db_session() as session:
        session.add(AnalysisJob(id=job_id, status="queued", row_count=result.row_count, processed_count=0, created_at=created, updated_at=created))
        session.commit()
    background_tasks.add_task(process_analysis, job_id, result.frame)
    return {"job_id": job_id, "status": "queued", "row_count": result.row_count, "created_at": created.isoformat()}


@app.get("/api/analyze/{job_id}", response_model=AnalysisJobSchema)
def get_analysis_job(job_id: str):
    with db_session() as session:
        job = session.get(AnalysisJob, job_id)
        if job is None:
            raise api_error(404, "not_found", "Analysis job was not found.")
        return job_to_dict(job)


@app.get("/api/model/metrics")
def model_metrics():
    if not model_bundle.metrics:
        return {
            "status": "not_evaluated", "model": model_bundle.model_info,
            "reason": "No evaluation report found. Run python -m app.ml.train --data data/raw/creditcard.csv.",
        }
    return model_bundle.metrics


@app.get("/api/model/info")
def model_info():
    return model_bundle.model_info or {"status": "not_trained", "reason": "No trained model artifact is available."}


@app.post("/api/predict")
def predict(request: PredictRequest):
    if not model_bundle.is_loaded:
        raise api_error(503, "model_not_available", "No trained model is loaded.")
    validated = []
    for index, row in enumerate(request.transactions):
        if set(row) != set(FEATURE_COLUMNS):
            missing = [key for key in FEATURE_COLUMNS if key not in row]
            unexpected = [key for key in row if key not in FEATURE_COLUMNS]
            raise api_error(422, "validation_error", f"Transaction {index} feature schema mismatch.", {"missing": missing, "unexpected": unexpected})
        if any(not math.isfinite(float(value)) for value in row.values()):
            raise api_error(422, "validation_error", f"Transaction {index} contains a non-finite value.")
        if row["Time"] < 0 or row["Amount"] < 0:
            raise api_error(422, "validation_error", f"Transaction {index}: Time and Amount must be >= 0.")
        validated.append({key: float(row[key]) for key in FEATURE_COLUMNS})
    frame = pd.DataFrame(validated, columns=FEATURE_COLUMNS)
    probabilities = model_bundle.predict_proba(frame)
    predictions = []
    for index, probability in enumerate(probabilities):
        p = float(probability)
        predictions.append({
            "index": index, "prediction": "fraud" if p >= model_bundle.threshold else "legitimate",
            "fraud_probability": p, "risk_tier": risk_tier(p, model_bundle.threshold),
        })
    return {"model_version": model_bundle.version, "threshold": model_bundle.threshold, "predictions": predictions}


@app.post("/api/model/reload")
def reload_model():
    model_bundle.reload()
    return {"model_loaded": model_bundle.is_loaded, "model_version": model_bundle.version}
