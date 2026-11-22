# FraudLens frontend

Lovable-generated React + TypeScript + TanStack Start frontend.

## Local development

```bash
bun install
cp .env.example .env
# Set VITE_API_BASE_URL=http://localhost:8000 in .env
bun run dev
```

The GitHub source copy has been updated to a 300 MiB / 300,000-row browser-side limit using streaming `File.stream()` validation. The currently hosted Lovable preview has not synced this change yet: its project still reports an older commit and a 10 MiB / 50,000-row validator.

To apply this source to the hosted project, connect `the-Hoeser/FraudLens` / `main` under Lovable Project Settings → Git and synchronize the source. Then retest the hosted Analyze page before treating the full upload limit as active there.

`VITE_API_BASE_URL` is a public URL only. Never put `DATABASE_URL`, database passwords or Supabase service-role credentials in a browser-visible variable.
