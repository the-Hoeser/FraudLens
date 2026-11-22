drop policy if exists "No browser access" on public.analysis_jobs;
create policy "No browser access" on public.analysis_jobs for all to anon, authenticated using (false) with check (false);
drop policy if exists "No browser access" on public.transactions;
create policy "No browser access" on public.transactions for all to anon, authenticated using (false) with check (false);
