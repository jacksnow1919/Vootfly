-- One row per flight API answer, for the admin Flight APIs tab (4 Nov 2026).
-- Pausing an API needs no new column: it sets public.suppliers.status to 'inactive'.
-- Only the server (service role) reads or writes this table.

create table if not exists public.provider_search_log (
  id uuid primary key default gen_random_uuid(),
  supplier text not null,
  fares integer not null default 0,
  duration_ms integer not null,
  error text,
  origin text,
  destination text,
  created_at timestamptz not null default now()
);

create index if not exists provider_search_log_created_idx
  on public.provider_search_log (created_at desc);

alter table public.provider_search_log enable row level security;
revoke all on public.provider_search_log from anon, authenticated;
grant all on public.provider_search_log to service_role;
