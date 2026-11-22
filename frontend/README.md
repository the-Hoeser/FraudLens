# FraudLens frontend

React 19 + TypeScript + TanStack Start frontend. This directory is the Vercel project root; the GitHub repository is the source of truth.

## Local development

```bash
bun install
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:8000
bun run dev
```

## API and database connection

The browser talks directly to the FastAPI service using the public `VITE_API_BASE_URL`. FastAPI talks to the Supabase PostgreSQL database using its private server-side `DATABASE_URL`. The browser must never receive database credentials, a Supabase service-role key, or any other secret.

For Vercel, add these environment variables under **Project → Settings → Environment Variables**:

- `VITE_API_BASE_URL`: the HTTPS origin of the deployed FastAPI service (for example, the Render service URL).
- `VITE_DEMO_MODE=false`: prevent synthetic fixtures from appearing in production.

Because `VITE_*` values are included in the browser bundle, only put a public API URL in this variable. Re-deploy after changing a Vercel environment variable.

The FastAPI host must allow the Vercel production and preview origins in CORS. The backend is deployed from the root `render.yaml` Blueprint; complete its first Render sync and configure its `DATABASE_URL` using the Supabase Session pooler URI on port `5432` before pointing the frontend at it. The repository's `render.yaml` includes the production origin and a project-scoped Vercel preview-origin regex.

## Vercel deployment

Vercel project settings:

- Root Directory: `frontend`
- Framework Preset: TanStack Start
- Node.js: 22.x or newer
- Install: `bun install`
- Build: `bun run build`

`vercel.json` declares the TanStack Start framework. Nitro compiles the app for Vercel Functions.

## CSV upload

The browser validates anonymized CSV files using streaming `File.stream()` reads, with a 300 MiB / 300,000-row application limit. It then uploads directly to FastAPI. The upload does not pass through a Vercel Function; the API host's own request-size and timeout limits still apply. Test the actual 150.8 MB benchmark file against the deployed API before treating the limit as end-to-end.

## Development modes

Demo fixtures are off by default. To intentionally preview sample UI data locally, set `VITE_DEMO_MODE=true` while leaving `VITE_API_BASE_URL` unset. In production, keep demo mode disabled.
