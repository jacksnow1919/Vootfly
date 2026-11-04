-- Online card checkout (3 Nov 2026, sales team flow 5 Nov 2026). One row per attempt to pay online.
--
-- Payment and booking status are separate on purpose: a card can be on hold while the ticket
-- is not issued, and that must never read as "confirmed". A row only becomes a booking in
-- public.bookings once Stripe confirms a real hold, so abandoned payment pages never reach
-- the admin booking list or the advisor alerts. The sales team issues the ticket, then charges.
--
-- Only the server reads or writes this table (service role). It holds passport details
-- until the ticket is settled, so anon and signed-in users get no access at all.

create table if not exists public.checkouts (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  test_mode boolean not null,
  supplier text not null default 'duffel',
  supplier_offer_id text not null,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'processing', 'authorized', 'paid', 'failed', 'cancelled', 'refunded')),
  booking_status text not null default 'draft'
    check (booking_status in ('draft', 'awaiting_payment', 'awaiting_ticket', 'payment_confirmed', 'booking_in_progress', 'confirmed', 'failed', 'cancelled', 'manual_review')),
  -- Exactly as the supplier quoted it ("373.42"), kept as text so it reaches the supplier unchanged.
  currency text not null,
  amount text not null,
  amount_minor bigint not null check (amount_minor > 0),
  base_amount text,
  tax_amount text,
  trip jsonb not null,
  travellers jsonb not null,
  contact jsonb not null,
  stripe_payment_intent_id text unique,
  -- What Stripe reports about the card, for staff. The card number and CVC are never stored.
  stripe_payment_method_id text,
  card_brand text,
  card_last4 text check (card_last4 ~ '^[0-9]{4}$'),
  card_exp_month smallint check (card_exp_month between 1 and 12),
  card_exp_year smallint,
  cardholder_name text,
  -- Stripe's last moment to charge this hold.
  hold_expires_at timestamptz,
  supplier_order_id text unique,
  supplier_pnr text,
  ticket_numbers text[] not null default '{}',
  failure_code text,
  failure_detail text,
  booking_id uuid references public.bookings (id) on delete set null,
  user_id uuid,
  utm_source text,
  click_id text,
  claimed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checkouts_status_created_idx
  on public.checkouts (booking_status, created_at desc);

alter table public.checkouts enable row level security;
revoke all on public.checkouts from anon, authenticated;
grant all on public.checkouts to service_role;
