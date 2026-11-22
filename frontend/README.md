# FraudLens frontend

React 19 + TypeScript + TanStack Start frontend. The GitHub repository is the source of truth, and Netlify deploys the frontend from the repository root configuration.

## Local development

```bash
bun install
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:8000
bun run dev
```

## API and database connection

The browser talks directly to the FastAPI service using the public `VITE_API_BASE_URL`. FastAPI talks to Supabase PostgreSQL using its private server-side `DATABASE_URL`. The browser must never receive database credentials, a Supabase service-role key, or any other secret.

For Netlify, add these environment variables under **Project configuration → Environment variables** for Production and Deploy Previews:

- `VITE_DEMO_MODE=false`: prevent synthetic fixtures from appearing in production.
- `VITE_API_BASE_URL`: HTTPS origin of the deployed FastAPI service (add once Render is live).

Because `VITE_*` values are included in the browser bundle, only put a public API URL in these variables. Redeploy after changing a variable.

The FastAPI host must allow the Netlify production and deploy-preview origins in CORS. The backend is deployed from the root `render.yaml` Blueprint; configure its `DATABASE_URL` using the Supabase Session pooler URI on port `5432` before pointing the frontend at it.

## Netlify deployment

The repository-root `netlify.toml` configures the existing site:

- Netlify project: `fraudylens-ai`
- Site URL: `https://fraudlens-ai-lsou.netlify.app`
- Base directory: `frontend`
- Build command: `bun install && bun run build`
- Publish directory: `dist/client`
- Node.js: 22
- Bun: 1.3.14

The Vite configuration uses `@netlify/vite-plugin-tanstack-start`. TanStack Start SSR, server routes, server functions and middleware are deployed as Netlify Functions. Do not add a static SPA fallback rewrite; it would interfere with SSR routes.

The production deployment is live. Verify the `main` branch remains the production branch in Netlify.

## CSV upload

The browser validates anonymized CSV files using streaming `File.stream()` reads, with a 300 MiB / 300,000-row application limit. It then uploads directly to FastAPI. The upload does not pass through a Netlify Function; the API host's own request-size and timeout limits still apply. Test the actual 150.8 MB benchmark file against the deployed API before treating the limit as end-to-end.

## Development modes

Demo fixtures are off by default. To intentionally preview sample UI data locally, set `VITE_DEMO_MODE=true` while leaving `VITE_API_BASE_URL` unset. In production, keep demo mode disabled.
