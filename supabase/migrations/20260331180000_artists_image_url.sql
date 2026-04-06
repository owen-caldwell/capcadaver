-- Optional mugshot URL for Known Accomplices grid.
alter table public.artists
  add column if not exists image_url text;
