# FraudLens FastAPI

Run locally:

```bash
python -m venv .venv
# activate the venv, then:
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Train the baseline from the anonymized Kaggle dataset:

```bash
python -m app.ml.train --data data/raw/creditcard.csv
```

The server refuses to return predictions before a model artifact exists. Upload validation uses a 300 MiB / 300,000-row server ceiling; the frontend also needs the patch in `scripts/patch_lovable_uploads.py` applied to the exported Lovable source.

For deployment, use the root `render.yaml` Blueprint. Configure `DATABASE_URL` to a server-side Supabase PostgreSQL connection string and set `CORS_ORIGINS` to the actual app origins. Never store a database password or service-role key in the browser.
