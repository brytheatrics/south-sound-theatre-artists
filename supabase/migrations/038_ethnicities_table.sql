-- 038_ethnicities_table.sql
-- Promote the hardcoded ETHNICITY_OPTIONS list into a real reference table
-- so Lexi can add/remove/rename ethnicities from the admin without a code
-- deploy. Mirrors the unions / areas / disciplines pattern.
--
-- "Other" stays as a sentinel option in the list so the submit form can
-- still surface a free-text "Other:" input when picked.

create table if not exists public.ethnicities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ethnicities_sort_order_idx
  on public.ethnicities (sort_order);

create trigger ethnicities_set_updated_at
  before update on public.ethnicities
  for each row execute function public.set_updated_at();

alter table public.ethnicities enable row level security;

create policy "Public can read ethnicities"
  on public.ethnicities for select
  to anon, authenticated
  using (true);

-- Seed with the existing hardcoded list so nothing changes for an artist
-- mid-submission. Sort order matches the order they were rendered in
-- the submit form before this change.
insert into public.ethnicities (name, sort_order) values
  ('African American / Black',         10),
  ('Asian',                            20),
  ('Hispanic / Latino',                30),
  ('Indigenous / Native American',     40),
  ('Middle Eastern / North African',   50),
  ('Pacific Islander',                 60),
  ('White / European',                 70),
  ('Multiracial / Mixed',              80),
  ('Prefer not to say',                90)
on conflict (name) do nothing;
