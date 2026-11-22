# FraudLens AI

Educational credit-card fraud detection and analytics. The Lovable UI is maintained in the [Lovable project](https://lovable.dev/projects/0c85117c-186d-40a5-a7e5-c54f5cdc98f7); this repository contains the Python API, training pipeline, deployment configuration and Supabase schema.

## Current status

- FastAPI backend source and ML training/evaluation pipeline are in `backend/`.
- Backend upload configuration: **300 MiB** and **300,000 rows**, streamed to disk and validated in 50,000-row chunks.
- Lovable's current browser-side CSV validator is still **10 MiB / 50,000 rows**. The streaming 300 MiB patch is in `scripts/patch_lovable_uploads.py`; it must be applied to an exported frontend source tree before the Lovable UI can accept the larger file.
- Dedicated Supabase project: [FraudLens AI](https://supabase.com/dashboard/project/oguoloekvtetjhjziiir), Mumbai region. The `analysis_jobs` and `transactions` tables are installed with RLS and deny-by-default browser policies. Backend persistence requires a server-only `DATABASE_URL`.
- The canonical Kaggle CSV is not included in Git. The ULB file is about 150.8 MB, so it is below the configured backend 300 MiB limit. It must be downloaded separately and never committed.
- No real-data performance results are claimed until the exact dataset has been trained and evaluated.

## Local setup

Python 3.11 is recommended.

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

- API health: http://localhost:8000/health
- Interactive API docs: http://localhost:8000/docs

## Download and train

Dataset: https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud

After accepting Kaggle's dataset terms and configuring the Kaggle CLI:

```bash
# From repository root
./scripts/fetch_kaggle_dataset.sh
python scripts/verify_dataset.py backend/data/raw/creditcard.csv
cd backend
python -m app.ml.train --data data/raw/creditcard.csv
```

Training creates `backend/artifacts/model.joblib`, `model_info.json`, `metrics.json` and threshold/comparison reports. The split is stratified 70/15/15. Candidate selection and threshold tuning use validation data; the test split is used once for final evaluation. Metrics include precision, recall, F1, PR-AUC, ROC-AUC and a confusion matrix. Accuracy is not treated as the primary metric.

## Deployment / test environment

`render.yaml` defines a Docker-based Render web service for the FastAPI backend. Open [Render](https://dashboard.render.com/) and create a Blueprint from this repository. Set the following secrets/configuration in the service:

- `DATABASE_URL`: Supabase Postgres connection string (server-side secret only).
- `CORS_ORIGINS`: exact Lovable preview/published origins.
- `MAX_UPLOAD_BYTES=314572800`
- `MAX_UPLOAD_ROWS=300000`

Then verify `/health` and `/docs`. The hosting proxy's body-size limit and service memory must be verified with the actual 150.8 MB CSV; application-level limits alone do not override hosting limits.

## Upload architecture

The current backend accepts up to 300 MiB/300,000 rows and streams the multipart request to a temporary file before chunk validation. The current Lovable frontend still rejects uploads over 10 MiB before they reach the server. Apply the included patch to a local export of the Lovable source:

```bash
python scripts/patch_lovable_uploads.py /path/to/exported-lovable-project
```

That patch changes the browser limit to 300 MiB / 300,000 rows and validates via `File.stream()`, rather than `File.text()`. It does not change the hosted Lovable preview until the patched source is committed/synced back into Lovable.

## Security and scope

Never expose Supabase database passwords or service-role keys in `VITE_*` variables. Do not upload PANs, card numbers, names, CVVs, account IDs, or real customer data. This is a learning/benchmark application, not a production payment decision system.
