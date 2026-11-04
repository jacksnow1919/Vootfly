-- Cards stored in the Basis Theory vault (4 Nov 2026). This table holds only a token id and
-- masked details. The card number and CVC are never stored in VootFly's database.
--
-- Only the server reads or writes this table (service role).

create table if not exists public.card_tokens (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  token_id text not null unique,
  test_mode boolean not null,
  brand text,
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  exp_month smallint check (exp_month between 1 and 12),
  exp_year smallint,
  cardholder_name text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.card_tokens enable row level security;
revoke all on public.card_tokens from anon, authenticated;
grant all on public.card_tokens to service_role;
