# FraudLens AI

Educational credit-card fraud detection and analytics. The Lovable UI is maintained in the [Lovable project](https://lovable.dev/projects/0c85117c-186d-40a5-a7e5-c54f5cdc98f7). This repository contains the FastAPI backend, ML pipeline, Supabase schema/migrations, upload patch, test bench and deployment configuration.

## Links

- **GitHub:** https://github.com/the-Hoeser/FraudLens
- **Lovable editor:** https://lovable.dev/projects/0c85117c-186d-40a5-a7e5-c54f5cdc98f7
- **Lovable preview:** https://id-preview--0c85117c-186d-40a5-a7e5-c54f5cdc98f7.lovable.app
- **API test bench (after GitHub Pages deploy):** https://the-hoeser.github.io/FraudLens/
- **Render API setup:** https://render.com/deploy?repo=https://github.com/the-Hoeser/FraudLens
- **Supabase:** https://supabase.com/dashboard/project/oguoloekvtetjhjziiir

## Current upload limit status

- **FastAPI backend:** 300 MiB / 300,000 rows, streamed to disk and validated in 50,000-row chunks.
- **Lovable browser UI:** still 10 MiB / 50,000 rows until an exported frontend source tree is patched and synced into Lovable. The patch script is included in `scripts/patch_lovable_uploads.py`.
- **API host:** request-size limits are provider-specific. Render is the intended API host; verify the deployed service accepts the full 150.8 MB benchmark file before relying on browser uploads. Vercel Functions are not used for this API route.

Therefore the upload size is **not yet extended end-to-end**. Backend setting is already raised; the original Lovable UI still blocks files over 10 MiB.

## Local backend

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

- Health: http://localhost:8000/health
- Swagger / API docs: http://localhost:8000/docs

## Dataset and training

Source: https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud

The canonical file has 284,807 rows, 492 fraud labels, 284,315 legitimate labels and 31 columns (Time, V1–V28, Amount, Class). It is not committed to this repository. Accept Kaggle's terms and configure Kaggle CLI credentials first.

```bash
# From repository root
./scripts/fetch_kaggle_dataset.sh
python scripts/verify_dataset.py backend/data/raw/creditcard.csv
cd backend
python -m app.ml.train --data data/raw/creditcard.csv
```

The training pipeline uses stratified 70/15/15 splits, compares class-weighted Logistic Regression and Random Forest on validation PR-AUC, selects the threshold on validation F1, and evaluates the held-out test split once. It reports precision, recall, F1, PR-AUC, ROC-AUC and a confusion matrix. No real-data results are claimed until this training command has run on the actual CSV.

## Deployment and Supabase

`render.yaml` defines a Docker-based Render web service. Open the Render Blueprint link above and configure:

- `DATABASE_URL`: server-side Supabase Postgres connection string.
- `CORS_ORIGINS`: exact Lovable preview/published origin and test-bench origin.
- `MAX_UPLOAD_BYTES=314572800`
- `MAX_UPLOAD_ROWS=300000`

Supabase project `FraudLens AI` is already provisioned in Mumbai; `analysis_jobs` and `transactions` tables are installed, RLS is enabled, and browser-deny policies are applied. Do not put database credentials or service-role keys in browser variables.

## Tests

```bash
cd backend
PYTHONPATH=. python -m pytest -q
```

A synthetic test suite validates API contracts, CSV schema, no-model behavior and training logic. Synthetic tests are not a substitute for the real Kaggle benchmark.

## Important limitations

This is an educational benchmark, not a production fraud platform. The dataset covers two days of European card activity in September 2013; V1–V28 are anonymized PCA features. Do not upload personal or payment-card data. A model score is not proof of fraud and must not be used to approve or decline real payments.
