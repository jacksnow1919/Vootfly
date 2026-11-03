-- Destination photos (28 Oct 2026). Applied to the live database through
-- Lovable's database tool; this file is the reproducibility record.
-- Photos are picked from Pixabay, downloaded once and stored in the public
-- bucket destination-photos (Pixabay does not allow permanent hotlinking).
create table if not exists public.destination_photos (
  place_code text primary key references public.places(code) on delete cascade,
  source text not null default 'pixabay' check (source in ('pixabay','unsplash')),
  source_id text not null,
  storage_path text not null,
  public_url text not null,
  thumb_url text not null,
  alt text not null,
  credit text,
  source_page_url text,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.destination_photos enable row level security;
create policy "Destination photos are public" on public.destination_photos for select to anon, authenticated using (true);
grant select on public.destination_photos to anon, authenticated;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('destination-photos', 'destination-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

