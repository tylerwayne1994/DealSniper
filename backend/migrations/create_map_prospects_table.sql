-- Create table to store prospect properties mapped on dashboard
create table if not exists public.map_prospects (
  id uuid default gen_random_uuid() primary key,
  name text,
  address text,
  units integer,
  lat double precision,
  lng double precision,
  source text check (source in ('upload','rapid_fire','manual','llm')) default 'upload',
  created_at timestamp with time zone default now()
);

-- Helpful index for spatial queries
create index if not exists map_prospects_lat_lng_idx on public.map_prospects (lat, lng);
