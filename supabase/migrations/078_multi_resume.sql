-- 078_multi_resume.sql
--
-- Multi-resume builder. Today every artist has a single jsonb resume
-- on `profiles.resume_data` (credits / training / skills arrays). v1.1
-- lets artists with multiple disciplines maintain multiple named resumes
-- (e.g. "Director Resume", "Scenic Design Resume", "Actor Resume") and
-- assign each entry to one or more of them.
--
-- Schema shape:
--   resumes          - one row per named resume per profile
--   resume_entries   - one row per credit/training/skill, with a
--                      `resume_ids` uuid[] that lists which resumes
--                      this entry appears on. Empty array = "inbox"
--                      (unassigned, surfaced in the editor as a pile
--                      that needs assigning).
--
-- The `kind` enum + jsonb `data` column keeps the table simple while
-- still letting credits / training / skills carry their own field shapes.
-- Render code reads `data` per kind.
--
-- `source` distinguishes hand-typed entries from auto-populated ones
-- created by production tagging (mig 079). The FK to production_credits
-- is added at the bottom of 079; we create the column here as nullable
-- so this migration is self-contained.
--
-- The existing profiles.resume_data jsonb column is intentionally NOT
-- dropped here. After the new system is verified in production, a later
-- migration will remove it. Until then, the new tables are authoritative
-- and the column is a one-way archive.

create type public.resume_entry_kind as enum ('credit', 'training', 'skill');
create type public.resume_entry_source as enum ('hand', 'production', 'admin');

create table public.resumes (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  name        text not null default 'Resume',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index resumes_profile_idx
  on public.resumes (profile_id, sort_order);

create trigger resumes_set_updated_at
  before update on public.resumes
  for each row execute function public.set_updated_at();

alter table public.resumes enable row level security;

create table public.resume_entries (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  kind                  public.resume_entry_kind not null,
  data                  jsonb not null default '{}'::jsonb,
  source                public.resume_entry_source not null default 'hand',
  -- FK constraint to production_credits added in 079 (table doesn't
  -- exist yet). Nullable: only set for source='production' entries.
  production_credit_id  uuid,
  -- Empty array = inbox / unassigned. Multiple ids = entry appears on
  -- multiple resumes (an actor-director showing acting credits on both
  -- their actor and director resumes).
  resume_ids            uuid[] not null default '{}',
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index resume_entries_profile_kind_idx
  on public.resume_entries (profile_id, kind, sort_order);
create index resume_entries_resume_ids_gin
  on public.resume_entries using gin (resume_ids);
create index resume_entries_production_credit_idx
  on public.resume_entries (production_credit_id) where production_credit_id is not null;

create trigger resume_entries_set_updated_at
  before update on public.resume_entries
  for each row execute function public.set_updated_at();

alter table public.resume_entries enable row level security;

-- Backfill: every existing profile gets one default resume. Existing
-- jsonb entries become resume_entries rows assigned to that resume.
-- Profiles with no resume_data still get the default resume so the
-- editor always has at least one resume to add entries to.

insert into public.resumes (profile_id, name, sort_order)
select id, 'Resume', 0
from public.profiles
where deleted_at is null;

-- Credits backfill. Uses jsonb_array_elements with ordinality so we
-- preserve the original ordering as sort_order.
insert into public.resume_entries (
  profile_id, kind, data, source, resume_ids, sort_order
)
select
  p.id,
  'credit'::public.resume_entry_kind,
  jsonb_build_object(
    'show',     coalesce(elem->>'show', ''),
    'role',     coalesce(elem->>'role', ''),
    'company',  coalesce(elem->>'company', ''),
    'director', coalesce(elem->>'director', ''),
    'year',     coalesce(elem->>'year', ''),
    'notes',    coalesce(elem->>'notes', '')
  ),
  'hand'::public.resume_entry_source,
  array[r.id],
  (ord - 1)::int
from public.profiles p
join public.resumes r on r.profile_id = p.id
cross join lateral jsonb_array_elements(
  coalesce(p.resume_data->'credits', '[]'::jsonb)
) with ordinality as t(elem, ord)
where p.deleted_at is null;

-- Training backfill.
insert into public.resume_entries (
  profile_id, kind, data, source, resume_ids, sort_order
)
select
  p.id,
  'training'::public.resume_entry_kind,
  jsonb_build_object(
    'title',       coalesce(elem->>'title', ''),
    'institution', coalesce(elem->>'institution', ''),
    'year',        coalesce(elem->>'year', ''),
    'notes',       coalesce(elem->>'notes', '')
  ),
  'hand'::public.resume_entry_source,
  array[r.id],
  (ord - 1)::int
from public.profiles p
join public.resumes r on r.profile_id = p.id
cross join lateral jsonb_array_elements(
  coalesce(p.resume_data->'training', '[]'::jsonb)
) with ordinality as t(elem, ord)
where p.deleted_at is null;

-- Skills backfill.
insert into public.resume_entries (
  profile_id, kind, data, source, resume_ids, sort_order
)
select
  p.id,
  'skill'::public.resume_entry_kind,
  jsonb_build_object(
    'category', coalesce(elem->>'category', ''),
    'items',    coalesce(elem->>'items', '')
  ),
  'hand'::public.resume_entry_source,
  array[r.id],
  (ord - 1)::int
from public.profiles p
join public.resumes r on r.profile_id = p.id
cross join lateral jsonb_array_elements(
  coalesce(p.resume_data->'skills', '[]'::jsonb)
) with ordinality as t(elem, ord)
where p.deleted_at is null;
