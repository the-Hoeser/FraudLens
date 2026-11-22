# FraudLens deployment on Netlify

## Frontend project

A Netlify site has been created for this repository:

- **Project:** `fraudlens-ai-lsou`
- **Dashboard:** https://app.netlify.com/projects/fraudlens-ai-lsou
- **Primary URL:** https://fraudlens-ai-lsou.netlify.app

The site is created but does not yet have a Git-connected deploy. In Netlify, open the project and choose **Project configuration → Build & deploy → Continuous deployment → Link repository**. Select GitHub repository `the-Hoeser/FraudLens` and production branch `main`.

The root `netlify.toml` configures the monorepo build:

| Setting | Value |
|---|---|
| Base directory | `frontend` |
| Build command | `bun install && bun run build` |
| Publish directory | `dist/client` |
| Node.js | 22 |
| Bun | 1.3.14 |

TanStack Start SSR, server routes, server functions and middleware are deployed through Netlify Functions using `@netlify/vite-plugin-tanstack-start`. Do not add a catch-all SPA rewrite; this app uses SSR.

## Environment variables

Set these in **Project configuration → Environment variables** for Production and Deploy Previews:

| Name | Value |
|---|---|
| `VITE_DEMO_MODE` | `false` |
| `VITE_API_BASE_URL` | HTTPS origin of the deployed FastAPI service (set once Render is live) |

These `VITE_*` values are embedded in the browser bundle. Only the public API origin belongs there. Never put `DATABASE_URL`, database passwords, Supabase service-role keys or other secrets into Netlify frontend variables.

Any environment-variable change requires a new build/deploy before the new value reaches the live site.

## Backend and database

The API remains a separate FastAPI Docker web service on Render. The root `render.yaml` defines a Free service in Singapore and configures CORS for the Netlify primary site and branch/deploy-preview hostnames.

Configure the Render-only `DATABASE_URL` using the Supabase **Connect → Session pooler** URI on port `5432`. Enter it directly in Render's Environment page; never commit it or put it in Netlify.

After Render deploys, verify `https://YOUR-API-HOST/health` reports `status=ok`, `database=connected`, and `database_provider=postgresql`. Then set `VITE_API_BASE_URL` in Netlify and redeploy.

## CSV upload

The browser uploads CSV files directly to FastAPI. Netlify is only serving the frontend; the upload does not pass through a Netlify Function. The backend hosting provider's request-body and timeout limits still apply. Test the actual 150.8 MB benchmark CSV before treating the 300 MiB application limit as an end-to-end guarantee.

## Local development

```bash
cd frontend
bun install
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:8000
bun run dev
```
