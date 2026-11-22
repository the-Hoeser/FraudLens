# FraudLens frontend

Lovable-generated React + TypeScript + TanStack Start frontend source.

## Local development

```bash
cd frontend
bun install
cp .env.example .env
bun run dev
```

The API base URL is configured with `VITE_API_BASE_URL`. This is a public browser URL, not a secret. It should point to the deployed FastAPI web service. Never put `DATABASE_URL`, Supabase service-role or database credentials in a VITE variable.

The current Lovable source still has a 10 MiB / 50,000-row client-side CSV limit. The backend is configured for 300 MiB / 300,000 rows. Apply the repository root script to an exported copy of this frontend to switch the UI to chunked `File.stream()` validation, then sync the patched source into Lovable before using the higher limit from the main app.
