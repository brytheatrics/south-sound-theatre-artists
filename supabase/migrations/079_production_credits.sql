-- 079_production_credits.sql
--
-- Production credits with cross-linking. Today productions are list rows
-- in /calendar with title + org + dates only. v1.1 lets verified orgs
-- (and self-claiming artists) tag cast / creative / crew on each
-- production, and surfaces a "Currently appearing in" badge on artist
-- profiles during the run window.
--
-- Schema:
--   production_credits  - one row per (production, person, position).
--                         profile_id may be null when the person isn't
--                         in the directory; display_name is always set.
--   resume_entries.production_credit_id  - FK back-pointer added at the
--                         end of this migration (column was created
--                         nullable in 078).
--
-- Source enum tracks who tagged the credit (org self-serve / artist
-- self-claim / admin). For v1.1 every credit lives immediately - no
-- claim-verification gating - and Lexi handles disputes from /admin.
-- The `created_by_email` column captures whoever submitted so admin
-- can spot abuse.

create type public.production_credit_category as enum ('cast', 'creative', 'crew');
create type public.production_credit_source as enum ('org', 'artist', 'admin');

create table public.production_credits (
  id              uuid primary key default gen_random_uuid(),
  production_id   uuid not null references public.productions(id) on delete cascade,
  -- profile_id null when the credited person isn't in the directory.
  -- display_name is always populated (from the profile if linked, or
  -- from free-text input when not).
  profile_id      uuid references public.profiles(id) on delete set null,
  display_name    text not null,
  -- Free-text role / position. "Hamlet" / "Director" / "Sound Designer".
  position        text not null,
  -- Grouping for the production page sectioning.
  category        public.production_credit_category not null,
  -- Who tagged this credit (org rep, the artist themselves, or admin).
  source          public.production_credit_source not null default 'admin',
  sort_order      integer not null default 0,
  -- Whoever submitted the tag. Helps admin spot patterns of abuse.
  created_by_email citext,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index production_credits_production_idx
  on public.production_credits (production_id, category, sort_order)
  where deleted_at is null;
create index production_credits_profile_idx
  on public.production_credits (profile_id)
  where deleted_at is null and profile_id is not null;
create index production_credits_deleted_idx
  on public.production_credits (deleted_at);

create trigger production_credits_set_updated_at
  before update on public.production_credits
  for each row execute function public.set_updated_at();

alter table public.production_credits enable row level security;

-- Wire the resume_entries -> production_credits FK now that both
-- tables exist. ON DELETE SET NULL: if an org untags an artist, the
-- artist's linked resume row stays but loses the link (app code
-- converts the row to source='hand' on detach so they keep the credit
-- they earned).
alter table public.resume_entries
  add constraint resume_entries_production_credit_fkey
  foreign key (production_credit_id)
  references public.production_credits(id)
  on delete set null;
