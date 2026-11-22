# Supabase

Dedicated project: https://supabase.com/dashboard/project/oguoloekvtetjhjziiir

Applied migrations:
- 20261122050511_fraudlens_core_tables
- 20261122050759_deny_browser_table_access

Tables: public.analysis_jobs and public.transactions. RLS is enabled; browser grants are revoked and deny policies are installed. Configure the Supabase PostgreSQL connection string as the Render secret DATABASE_URL. Do not put database passwords or service-role credentials in the frontend.
