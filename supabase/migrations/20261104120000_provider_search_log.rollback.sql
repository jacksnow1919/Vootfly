-- Removes the flight API history. Pausing and resuming keep working without it.
drop table if exists public.provider_search_log;
