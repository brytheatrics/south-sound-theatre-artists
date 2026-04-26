-- 004_form_overhaul.sql
-- Substantial form/schema rework based on user feedback:
--   - Drop availability_status: stale flags are worse than no flag, the
--     contact form returns the real-time answer.
--   - Drop experience_level: people have different levels per discipline,
--     and the bio covers it.
--   - Replace union_status text with unions text[]: multi-membership is
--     normal (AEA + SDC, AEA + AGMA, etc.).
--   - Replace age_range text with numeric playable_age_min / max so the
--     directory can filter by playable-age window.
--   - Add explicit socials columns (Facebook, TikTok, LinkedIn, X, YouTube).
--   - Create admin-editable areas + unions tables, mirroring disciplines.

-- =====================================================================
-- areas
-- =====================================================================
create table public.areas (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index areas_sort_order_idx on public.areas (sort_order);

create trigger areas_set_updated_at
  before update on public.areas
  for each row execute function public.set_updated_at();

alter table public.areas enable row level security;

create policy "Public can read areas"
  on public.areas for select
  to anon, authenticated
  using (true);

insert into public.areas (name, sort_order) values
  ('Tacoma',            10),
  ('Olympia',           20),
  ('Gig Harbor',        30),
  ('Other South Sound', 40),
  ('Other',             50)
on conflict (name) do nothing;

-- =====================================================================
-- unions
-- =====================================================================
create table public.unions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index unions_sort_order_idx on public.unions (sort_order);

create trigger unions_set_updated_at
  before update on public.unions
  for each row execute function public.set_updated_at();

alter table public.unions enable row level security;

create policy "Public can read unions"
  on public.unions for select
  to anon, authenticated
  using (true);

insert into public.unions (name, description, sort_order) values
  ('AEA',       'Actors Equity Association',                  10),
  ('AGMA',      'American Guild of Musical Artists',          20),
  ('IATSE',     'Technical theatre / stagehands',             30),
  ('SDC',       'Stage Directors and Choreographers Society', 40),
  ('USA',       'United Scenic Artists',                      50),
  ('AFM',       'American Federation of Musicians',           60),
  ('Non-Union', null,                                         70),
  ('Other',     null,                                         80)
on conflict (name) do nothing;

-- =====================================================================
-- profiles: drop legacy fields, add new ones
-- =====================================================================
alter table public.profiles
  drop column availability_status,
  drop column experience_level,
  drop column union_status,
  drop column age_range,
  add  column unions            text[] not null default '{}',
  add  column playable_age_min  smallint check (playable_age_min between 0 and 120),
  add  column playable_age_max  smallint check (playable_age_max between 0 and 120),
  add  column facebook_url      text,
  add  column tiktok_handle     text,
  add  column linkedin_url      text,
  add  column twitter_handle    text,
  add  column youtube_url       text,
  add  constraint profiles_playable_age_chk
    check (
      (playable_age_min is null and playable_age_max is null)
      or (playable_age_min is not null and playable_age_max is not null
          and playable_age_min <= playable_age_max)
    );

create index profiles_unions_idx on public.profiles using gin (unions);

-- =====================================================================
-- pending_submissions: same shape changes
-- =====================================================================
alter table public.pending_submissions
  drop column availability_status,
  drop column experience_level,
  drop column union_status,
  drop column age_range,
  add  column unions            text[] not null default '{}',
  add  column playable_age_min  smallint check (playable_age_min between 0 and 120),
  add  column playable_age_max  smallint check (playable_age_max between 0 and 120),
  add  column facebook_url      text,
  add  column tiktok_handle     text,
  add  column linkedin_url      text,
  add  column twitter_handle    text,
  add  column youtube_url       text,
  add  constraint pending_submissions_playable_age_chk
    check (
      (playable_age_min is null and playable_age_max is null)
      or (playable_age_min is not null and playable_age_max is not null
          and playable_age_min <= playable_age_max)
    );
