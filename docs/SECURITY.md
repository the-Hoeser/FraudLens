# Security notes

- Supabase `DATABASE_URL` is a server-side secret. Never put it in a `VITE_*` variable.
- The two public tables have RLS enabled and deny policies for anon/authenticated roles. The FastAPI service uses the dedicated database connection.
- Restrict `CORS_ORIGINS` to the Lovable/ test frontend origins.
- The API accepts only the anonymized 30-feature schema plus optional Class; extra columns are rejected.
- Never upload names, card numbers, PAN, CVV, addresses, account IDs or real customer/payment data.
- This benchmark is not for live payment decisions.
