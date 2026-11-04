-- Removes the online checkout table. Check first that no row is in manual_review or awaiting a refund.
drop table if exists public.checkouts;
