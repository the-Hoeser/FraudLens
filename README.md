# FraudLens AI

An educational fraud-detection analytics application with a React/TanStack Start frontend, FastAPI backend, scikit-learn training pipeline and Supabase PostgreSQL persistence.

## Links

- **Frontend target (Netlify):** https://fraudylens-ai.netlify.app
- **GitHub source:** https://github.com/the-Hoeser/FraudLens
- **FastAPI deployment Blueprint:** https://render.com/deploy?repo=https://github.com/the-Hoeser/FraudLens
- **Supabase project:** https://supabase.com/dashboard/project/oguoloekvtetjhjziiir

The Netlify production site is live at https://fraudylens-ai.netlify.app. The frontend calls the separate FastAPI backend; add `VITE_API_BASE_URL` once the Render API is deployed. The frontend is deployed separately from the API; set `VITE_API_BASE_URL` in Vercel to the actual HTTPS URL of the deployed FastAPI service before the app can show live backend data.

## Architecture

```
Browser
  └── FraudLens React / TanStack Start (Netlify)
        └── HTTPS requests to FastAPI (Render)
              ├── ML inference and CSV analysis
              └── SQLAlchemy → Supabase PostgreSQL
```

The browser never connects directly to Supabase and never receives database credentials. The FastAPI service owns database access through the server-side `DATABASE_URL`.

## Repository structure

- `frontend/` — React 19 + TypeScript + TanStack Start UI and API client.
- `netlify.toml` — Netlify monorepo build configuration.
- `backend/` — FastAPI endpoints, model inference, CSV validation, SQLAlchemy persistence, training pipeline.
- `supabase/` — database schema and migration files.
- `testbed/` — standalone API diagnostic/test page.
- `docs/` — deployment, data, evaluation and security notes.
- `scripts/` — Kaggle download and dataset integrity tools.

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

### Frontend

Use Bun (the repository includes `frontend/bun.lock`):

```bash
cd frontend
bun install
cp .env.example .env
# VITE_API_BASE_URL=http://localhost:8000
# VITE_DEMO_MODE=false
bun run dev
```

## Deploy frontend to Netlify

1. Open the existing [FraudLens Netlify project](https://app.netlify.com/projects/fraudylens-ai).
2. Link the GitHub repository `the-Hoeser/FraudLens` and use `main` as the production branch.
3. The root `netlify.toml` supplies the `frontend` base directory, Bun install/build commands, and `dist/client` publish directory.
4. Add `VITE_DEMO_MODE=false`; add `VITE_API_BASE_URL` after the Render API is live.
5. Deploy. Subsequent pushes to `main` should create production deploys.

Only public API configuration belongs in `VITE_*` variables. Never add `DATABASE_URL`, database passwords or Supabase service-role keys to Netlify frontend environment variables.

See [Netlify deployment notes](docs/NETLIFY_DEPLOYMENT.md).

## Deploy the API and connect Supabase

The root `render.yaml` defines a Docker web service on Render's Free plan in Singapore. The Blueprint creates the backend service; complete its initial sync in Render and set:

- `DATABASE_URL`: Supabase **Connect → Session pooler** URI on port `5432` (server-side secret only). Copy the whole URI from the dashboard; do not construct the pooler host or commit the password.
- `MAX_UPLOAD_BYTES=314572800`
- `MAX_UPLOAD_ROWS=300000`

CORS is configured for the `fraudylens-ai.netlify.app` production site and its Netlify branch/deploy-preview hostname pattern, plus local development. The backend health endpoint reports whether it is using PostgreSQL or SQLite. Production should report `database=connected` and `database_provider=postgresql`.

The Supabase schema is in `supabase/schema.sql`; the dedicated project already has `analysis_jobs` and `transactions` tables with RLS enabled and browser access denied.

## Upload limits

The frontend and backend application limits are both 300 MiB / 300,000 rows. The browser validates with streaming `File.stream()`; the backend streams the incoming upload to a temporary file and validates in chunks. The browser sends the upload directly to FastAPI, not through a Netlify Function. The API hosting provider's own request-body limit still applies—verify using the real 150.8 MB ULB benchmark file before treating the limit as end-to-end.

## Dataset and model training

Dataset: https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud

Expected canonical file: 284,807 rows, 492 fraud labels and 31 columns (`Time`, `V1`–`V28`, `Amount`, `Class`). The dataset is not committed to Git.

```bash
./scripts/fetch_kaggle_dataset.sh
python scripts/verify_dataset.py backend/data/raw/creditcard.csv
cd backend
python -m app.ml.train --data data/raw/creditcard.csv
```

Training compares class-weighted Logistic Regression and Random Forest, selects the model/threshold using validation data, and evaluates the held-out test set once. No real-dataset metrics are claimed until this command has run on the actual Kaggle CSV.

## CI

GitHub Actions runs backend tests and frontend build/typecheck/tests on pushes and pull requests to `main`.

## Scope

Educational benchmark only. The public dataset covers two days of European card activity in September 2013; V1–V28 are anonymized PCA components. Do not upload real customer records, PANs, CVVs, names or account IDs. Fraud scores are not proof of fraud and must not drive live payment decisions.
