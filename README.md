# FraudLens AI

Educational credit-card fraud detection and analytics. This repository now contains the Lovable React/TypeScript frontend source under `frontend/`, a Python FastAPI backend under `backend/`, Supabase schema/migrations, a browser API test bench, CI, and deployment configuration.

## Links

- **GitHub repository:** https://github.com/the-Hoeser/FraudLens
- **Lovable editor:** https://lovable.dev/projects/0c85117c-186d-40a5-a7e5-c54f5cdc98f7
- **Lovable preview:** https://id-preview--0c85117c-186d-40a5-a7e5-c54f5cdc98f7.lovable.app
- **API test bench (after Pages is enabled):** https://the-hoeser.github.io/FraudLens/
- **Render Blueprint:** https://render.com/deploy?repo=https://github.com/the-Hoeser/FraudLens
- **Supabase project:** https://supabase.com/dashboard/project/oguoloekvtetjhjziiir

## Upload limit — exact current state

| Layer | Limit | Status |
|---|---:|---|
| FastAPI backend source | 300 MiB / 300,000 rows | Configured |
| GitHub `frontend/` source | 300 MiB / 300,000 rows | Patched with streaming `File.stream()` validation |
| Standalone `testbed/` page | 300 MiB / 300,000 rows | Patched with streaming validation |
| Hosted Lovable preview | 10 MiB / 50,000 rows | **Not yet synced** |
| Deployed API host | Must be verified | Render service not deployed yet |

I verified that the Lovable project's latest commit is still its earlier scaffold commit and its `src/lib/csv/schema.ts` still declares 10 MiB / 50,000 rows. The source copy in this repository has been updated, but it has not yet synced back into the hosted Lovable project. Connect this repository/branch to the Lovable project's **Settings → Git** and sync `main`; then verify the deployed preview's new limit.

The backend's application-level limit is 300 MiB. This does not prove that a hosting proxy will accept a 150.8 MB request. The actual Kaggle file upload must be tested after the API service is deployed.

## Repository structure

- `frontend/` — Lovable React + TypeScript + TanStack Start source; run separately from its directory.
- `backend/` — FastAPI, SQLAlchemy persistence, CSV validation, inference and ML training.
- `testbed/` — standalone HTML page to test API health, metrics, streaming file validation, uploads and jobs.
- `supabase/` — SQL schema and applied migrations.
- `docs/` — data, model evaluation, security, Supabase and upload notes.
- `scripts/` — Kaggle download/integrity-check scripts and Lovable upload patch utility.

## Run locally

### Backend

Python 3.11 recommended:

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
- API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
bun install
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:8000 in .env
bun run dev
```

Do not put database passwords or service-role keys in a `VITE_*` variable.

## Test environment setup

1. **API:** Open the Render Blueprint link above, connect this repository, create the web service from `render.yaml`, and configure the secrets below.
2. **Pages:** Open repository **Settings → Pages**, set Source to **GitHub Actions**, and save. Then open **Actions → Deploy API test bench to GitHub Pages → Run workflow**. The workflow is manual because the first attempt could not create the Pages site with its automation token.
3. **Test bench:** After the Pages workflow succeeds, open https://the-hoeser.github.io/FraudLens/ and enter the deployed API base URL.
4. **Health:** Verify `/health` returns `status=ok`, `database=connected`, and check whether a trained model is loaded.
5. **Large file:** upload the actual Kaggle CSV; verify that the hosting ingress accepts it and the job completes before treating the upload limit as end-to-end.

Render environment variables:
- `DATABASE_URL`: Supabase Postgres connection string (server-only secret).
- `CORS_ORIGINS`: exact Lovable preview origin and `https://the-hoeser.github.io`.
- `MAX_UPLOAD_BYTES=314572800`
- `MAX_UPLOAD_ROWS=300000`

The Render service has not yet been provisioned from the Blueprint, and no `DATABASE_URL` secret has been set there. Supabase's dedicated Mumbai project and database schema are already provisioned; backend persistence becomes active after this server-side secret is configured.

## Dataset and training

Source: https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud

Expected canonical data: 284,807 rows, 492 fraud labels, 284,315 legitimate labels and 31 columns (Time, V1–V28, Amount, Class). The CSV is not committed to Git. Accept the Kaggle terms and configure Kaggle CLI credentials, then run:

```bash
# From repository root
./scripts/fetch_kaggle_dataset.sh
python scripts/verify_dataset.py backend/data/raw/creditcard.csv
cd backend
python -m app.ml.train --data data/raw/creditcard.csv
```

The training pipeline uses stratified 70/15/15 splits, compares class-weighted Logistic Regression and Random Forest using validation PR-AUC, selects the threshold using validation F1, and evaluates the held-out test set once. It reports precision, recall, F1, PR-AUC, ROC-AUC and confusion matrix. No real-data performance results are claimed yet.

## Supabase

Dedicated project: https://supabase.com/dashboard/project/oguoloekvtetjhjziiir

Tables `analysis_jobs` and `transactions` are installed. RLS is enabled; browser table access is denied. The FastAPI host should use the database connection string as a server-only secret.

## CI

Backend CI runs on pushes to `main` and pull requests. The in-memory SQLite test fixture uses a shared `StaticPool` to work across the API worker thread. See Actions for the current check status.

## Scope and limitations

This is an educational benchmark, not a production payment decision system. The public dataset covers two days of European card activity in September 2013; V1–V28 are anonymized PCA components. Do not upload real customer records, PANs, CVVs, names or account IDs.
