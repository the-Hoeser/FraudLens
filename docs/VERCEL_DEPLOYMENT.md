# Vercel deployment

## Frontend project

Create a Vercel project from the GitHub repository `the-Hoeser/FraudLens`.

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | TanStack Start |
| Node.js | 22.x |
| Install Command | `bun install` |
| Build Command | `bun run build` |

The directory contains `vercel.json`, which declares the `tanstack-start` framework. Vite builds the app with the official TanStack Start plugin and Nitro's Vercel deployment adapter.

## Environment variables

Set in **Vercel → Project → Settings → Environment Variables** for Preview and Production:

| Name | Value |
|---|---|
| `VITE_API_BASE_URL` | Public HTTPS origin of the deployed FastAPI service |
| `VITE_DEMO_MODE` | `false` |

`VITE_*` variables are embedded in the browser bundle. Only the public API URL belongs there. Never add a Supabase database URL, database password, service-role key or any other secret to Vercel's frontend environment.

After changing an environment variable, redeploy the frontend.

## Backend and database

The Vercel project only hosts the frontend. It calls the FastAPI service directly from the browser. Deploy the API using the root `render.yaml` Blueprint and set the server-only `DATABASE_URL` to the Supabase PostgreSQL connection string.

The API's `CORS_ORIGINS` contains the likely production aliases `https://fraud-lens.vercel.app` and `https://fraudlens-ai.vercel.app`; `CORS_ORIGIN_REGEX` permits deployment-specific URLs for either project-name prefix. Confirm the production origin in Vercel and add it to `CORS_ORIGINS` if it differs. If Vercel assigns a different production domain, add that exact origin to the API's `CORS_ORIGINS` and redeploy the API.

Verify the backend before the frontend:

1. Open `https://YOUR-API-HOST/health`.
2. Confirm `status=ok`, `database=connected`, and `database_provider=postgresql`.
3. Confirm the model state is intentional (loaded after training, or not loaded while waiting for training).
4. Set `VITE_API_BASE_URL` to that API origin in Vercel and deploy the frontend.
5. Open `/settings` in FraudLens and confirm API and PostgreSQL status.

## Large CSV uploads

The browser uploads directly to the FastAPI origin. The file does not pass through a Vercel Function, so Vercel Function request-body limits do not apply. The FastAPI host's ingress/body-size limit and request timeout still apply. Test the actual 150.8 MB benchmark CSV after deployment; the 300 MiB application setting alone does not prove the host accepts it.
