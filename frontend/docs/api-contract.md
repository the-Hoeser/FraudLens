# FraudLens AI — API contract (v0.1)

The frontend (`src/lib/api/`) and the FastAPI backend (`backend/app/`) both follow this
document. JSON keys are `snake_case`. Timestamps are ISO-8601 UTC strings.

## Conventions

### Error envelope

Every non-2xx response uses the same envelope:

```json
{ "error": { "code": "string", "message": "human readable", "details": null } }
```

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `bad_request` | Malformed request (e.g. not multipart) |
| 404 | `not_found` | Unknown transaction / job id |
| 413 | `file_too_large` | Upload exceeds `MAX_UPLOAD_BYTES` |
| 422 | `validation_error` | Query/body failed validation (`details` = list of field errors) |
| 422 | `csv_invalid` | CSV failed schema validation (`details.errors` = list of `{row, column, message}`) |
| 503 | `model_not_available` | No trained model artifact is loaded |
| 500 | `internal_error` | Unexpected failure (never leaks stack traces) |

### Feature schema

Exactly 30 numeric input columns, order-independent: `Time`, `V1` … `V28`, `Amount`.
`Class` (0/1) is optional in uploads and is **ignored for prediction** (it is only
echoed back as `label` for offline comparison). Any other column is rejected, which
keeps personal or payment data out of the system.

Validation rules: no missing values, finite numbers only, `Time >= 0`, `Amount >= 0`,
`Class ∈ {0,1}` when present, at least 1 data row, at most `MAX_UPLOAD_ROWS` rows
(default 50 000) and `MAX_UPLOAD_BYTES` (default 10 MiB).

### Risk tier (product convention, not a calibrated probability)

Given fraud probability `p` and decision threshold `t`:

- `critical` if `p >= max(0.9, t)`
- `high` if `p >= t`
- `medium` if `p >= t / 2`
- `low` otherwise

`prediction` is `"fraud"` when `p >= t`, else `"legitimate"`.

## Shared objects

### Transaction

```json
{
  "id": "txn_…",
  "timestamp": "2026-01-01T12:00:00Z",
  "amount": 149.62,
  "time_offset_seconds": 0.0,
  "prediction": "fraud | legitimate",
  "fraud_probability": 0.87,
  "risk_tier": "low | medium | high | critical",
  "review_status": "unreviewed | in_review | confirmed_fraud | cleared",
  "model_version": "lr-2026-01-01-abc123",
  "threshold": 0.42,
  "analysis_job_id": "job_… | null",
  "label": 1,
  "explanation": {
    "method": "logistic_regression_coefficients | permutation | none",
    "summary": "Plain-language summary",
    "top_features": [{ "feature": "V14", "value": -5.1, "contribution": 0.31 }]
  },
  "features": { "Time": 0.0, "V1": -1.35, "…": 0, "Amount": 149.62 }
}
```

`label`, `explanation` and `features` may be `null`. `features` is only returned by
the detail endpoint.

### ModelInfo

```json
{
  "name": "fraudlens-baseline",
  "version": "lr-2026-01-01-abc123",
  "algorithm": "logistic_regression | random_forest | xgboost",
  "training_run_id": "run_…",
  "trained_at": "…",
  "dataset": { "name": "ULB Credit Card Fraud Detection", "source_url": "https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud", "rows": 284807, "positive_rate": 0.00172, "sha256": "… | null" },
  "feature_schema": ["Time", "V1", "…", "Amount"],
  "threshold": 0.42,
  "threshold_selection": "Max F1 on validation split",
  "class_imbalance_strategy": "class_weight=balanced",
  "limitations": ["…"]
}
```

## Endpoints

### `GET /health`

```json
{ "status": "ok", "version": "0.1.0", "model_loaded": false, "model_version": null,
  "database": "not_configured | connected | error", "database_provider": "postgresql | sqlite | unknown",
  "timestamp": "…" }
```

### `GET /api/dashboard/summary`

Aggregates over transactions stored by completed analysis jobs (empty when none).

```json
{
  "transactions_analyzed": 0, "flagged_count": 0, "review_queue_count": 0, "flagged_amount": 0.0,
  "volume_trend": [{ "date": "2026-01-01", "total": 10, "flagged": 1 }],
  "class_breakdown": { "fraud": 0, "legitimate": 0 },
  "risk_distribution": [{ "tier": "low", "count": 0 }, { "tier": "medium", "count": 0 }, { "tier": "high", "count": 0 }, { "tier": "critical", "count": 0 }],
  "recent_flagged": [Transaction],
  "model_version": null,
  "generated_at": "…"
}
```

`review_queue_count` = flagged transactions with `review_status` in `unreviewed | in_review`.
`recent_flagged` holds at most 10 items, newest first.

### `GET /api/transactions`

Query parameters (all optional): `page` (≥1, default 1), `page_size` (1–100, default 25),
`q` (substring match on `id`), `prediction`, `risk_tier`, `review_status`,
`min_amount`, `max_amount` (≥0), `date_from`, `date_to` (`YYYY-MM-DD`, inclusive),
`sort_by` (`timestamp | amount | fraud_probability | risk_tier`, default `timestamp`),
`sort_dir` (`asc | desc`, default `desc`).

```json
{ "items": [Transaction], "page": 1, "page_size": 25, "total": 0, "total_pages": 0 }
```

### `GET /api/transactions/{id}` → `Transaction` (with `features`), or 404.

### `POST /api/analyze`

`multipart/form-data` with a single `file` field (CSV). Validates first (413/422), then
returns 503 `model_not_available` if no model is loaded, otherwise:

```json
202 { "job_id": "job_…", "status": "queued", "row_count": 120, "created_at": "…" }
```

### `GET /api/analyze/{job_id}`

```json
{
  "job_id": "job_…", "status": "queued | running | completed | failed",
  "created_at": "…", "updated_at": "…", "row_count": 120, "processed_count": 120,
  "model_version": "… | null", "threshold": 0.42,
  "summary": { "flagged_count": 3, "flagged_amount": 512.1, "fraud_rate": 0.025 },
  "results": [{ "row_index": 0, "transaction_id": "txn_…", "prediction": "legitimate", "fraud_probability": 0.01, "risk_tier": "low" }],
  "error": null
}
```

`summary`/`results` are `null` until `completed`; `results` is capped at 500 rows.
`error` is `{ "code", "message" }` when `failed`.

### `GET /api/model/metrics`

Evaluated (metrics come from the held-out **test** split, evaluated once; the threshold
curve comes from the **validation** split and is what threshold tuning used):

```json
{
  "status": "evaluated",
  "model": ModelInfo,
  "split": "test",
  "threshold": 0.42,
  "metrics": { "precision": 0.8, "recall": 0.8, "f1": 0.8, "pr_auc": 0.8, "roc_auc": 0.97, "support_positive": 98, "support_negative": 56864 },
  "confusion_matrix": { "tp": 0, "fp": 0, "tn": 0, "fn": 0 },
  "threshold_curve_split": "validation",
  "threshold_curve": [{ "threshold": 0.5, "precision": 0.8, "recall": 0.8, "f1": 0.8, "tp": 0, "fp": 0, "tn": 0, "fn": 0 }],
  "evaluated_at": "…"
}
```

Not evaluated (HTTP 200):

```json
{ "status": "not_evaluated", "model": null, "reason": "No evaluation report found. Run `python -m app.ml.train`." }
```

### `POST /api/predict`

```json
{ "transactions": [{ "Time": 0, "V1": 0, "…": 0, "Amount": 1.0 }] }
```

1–1000 rows, same schema rules as CSV (extra keys rejected). Returns 503 when no model.

```json
{ "model_version": "…", "threshold": 0.42,
  "predictions": [{ "index": 0, "prediction": "legitimate", "fraud_probability": 0.01, "risk_tier": "low" }] }
```