-- FraudLens persistence schema. Use only with a dedicated project.
create extension if not exists pgcrypto;

create table if not exists public.analysis_jobs (
  id text primary key,
  status text not null check (status in ('queued','running','completed','failed')),
  row_count integer not null check (row_count >= 0),
  processed_count integer not null default 0 check (processed_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  model_version text,
  threshold double precision,
  summary jsonb,
  results jsonb,
  error jsonb
);

create table if not exists public.transactions (
  id text primary key,
  timestamp text not null,
  amount double precision not null check (amount >= 0),
  prediction text not null check (prediction in ('fraud','legitimate')),
  fraud_probability double precision not null check (fraud_probability between 0 and 1),
  risk_tier text not null check (risk_tier in ('low','medium','high','critical')),
  review_status text not null check (review_status in ('unreviewed','in_review','confirmed_fraud','cleared')),
  model_version text not null,
  threshold double precision not null check (threshold between 0 and 1),
  analysis_job_id text not null references public.analysis_jobs(id) on delete cascade,
  label smallint check (label in (0,1)),
  explanation jsonb,
  features jsonb
);

create index if not exists transactions_timestamp_idx on public.transactions (timestamp desc);
create index if not exists transactions_prediction_idx on public.transactions (prediction);
create index if not exists transactions_risk_tier_idx on public.transactions (risk_tier);
create index if not exists transactions_job_idx on public.transactions (analysis_job_id);

alter table public.analysis_jobs enable row level security;
alter table public.transactions enable row level security;
revoke all on table public.analysis_jobs from anon, authenticated;
revoke all on table public.transactions from anon, authenticated;
grant all on table public.analysis_jobs to service_role;
grant all on table public.transactions to service_role;

drop policy if exists "No browser access" on public.analysis_jobs;
create policy "No browser access" on public.analysis_jobs for all to anon, authenticated using (false) with check (false);
drop policy if exists "No browser access" on public.transactions;
create policy "No browser access" on public.transactions for all to anon, authenticated using (false) with check (false);
