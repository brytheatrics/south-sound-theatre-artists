-- 065_organizations_consolidate.sql
--
-- Merges `event_sources` (calendar-sync orgs, 26 rows) and
-- `verified_orgs` (callboard auto-publish orgs, 2 filler rows) into a
-- single `organizations` table. Decision rationale: event_sources
-- already carries every public-facing field /theatres needs, and the
-- two tables conceptually describe the same thing (a producing
-- organization). Splitting them forces every consumer to JOIN or
-- duplicate metadata.
--
-- The 2 verified_orgs rows are placeholder data (`*.dev.ssta.local`
-- emails); per Blake they get dropped entirely. Real verified orgs
-- come back through the existing /callboard/apply-verified flow,
-- which now writes to organizations directly.
--
-- Backfill is event_sources -> organizations 1:1, so existing
-- productions.source_id values become valid organizations.id values
-- without an UPDATE. productions.verified_org_id is dropped because
-- it only ever pointed at the filler verified_orgs rows; same for
-- callboard_posts.verified_org_id.

-- Some installs already have a `citext` extension, others not. The
-- contact_email column on the old verified_orgs was citext, so we
-- preserve that semantics on organizations.contact_email.
create extension if not exists citext;

create table public.organizations (
  id                  uuid primary key default gen_random_uuid(),

  -- Identity (was event_sources.org_slug / org_name)
  slug                text not null unique,
  name                text not null,

  -- Public-facing metadata. `description`, `homepage_url`, `public_email`,
  -- `logo_url`, `logo_bg` mirror the event_sources fields powering /theatres.
  description         text,
  homepage_url        text,
  public_email        text,
  logo_url            text,
  logo_bg             text not null default 'paper',

  -- Region tag (event_sources.area_id).
  area_id             uuid references public.areas(id) on delete set null,

  -- Calendar-sync extraction config (event_sources). Nullable for
  -- manual/verified-only orgs that don't have an automated source.
  source_url          text,
  adapter             text not null default 'manual',
  notes               text,
  cadence_days        integer not null default 30,
  active              boolean not null default true,

  -- Calendar-sync bookkeeping (event_sources).
  last_hash           text,
  last_checked_at     timestamptz,
  last_successful_at  timestamptz,
  last_show_count     integer,
  last_status         text not null default 'pending',
  last_error          text,
  cooldown_until      timestamptz,

  -- Callboard auto-publish (was verified_orgs.contact_email + .verified).
  -- contact_email is the canonical email used for matching at submit
  -- time; public_email is the address we display on /theatres (often the
  -- same value, sometimes different - e.g. casting@ vs hello@).
  contact_email       citext,
  verified            boolean not null default false,

  -- Soft-delete + housekeeping.
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint organizations_logo_bg_check
    check (logo_bg in ('paper', 'paper-2', 'bg-raised', 'ink', 'accent')),
  constraint organizations_status_check
    check (last_status in ('pending', 'ok', 'unchanged', 'empty', 'error'))
);

create index organizations_active_idx
  on public.organizations (active, cadence_days, last_checked_at);
create index organizations_status_idx
  on public.organizations (last_status);
create index organizations_area_idx
  on public.organizations (area_id);
create index organizations_verified_idx
  on public.organizations (verified) where deleted_at is null;
create index organizations_contact_email_idx
  on public.organizations (contact_email);
create index organizations_deleted_idx
  on public.organizations (deleted_at);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;

-- Backfill from event_sources. Preserves IDs so productions.source_id
-- continues to point at the right row when it becomes organization_id.
-- adapter is preserved as-is (most are 'ai-generic' from the v2.x audit).
insert into public.organizations (
  id, slug, name,
  description, homepage_url, public_email, logo_url, logo_bg,
  area_id,
  source_url, adapter, notes, cadence_days, active,
  last_hash, last_checked_at, last_successful_at, last_show_count,
  last_status, last_error, cooldown_until,
  verified,
  created_at, updated_at
)
select
  id, org_slug, org_name,
  description, homepage_url, public_email, logo_url, logo_bg,
  area_id,
  source_url, adapter, notes, cadence_days, active,
  last_hash, last_checked_at, last_successful_at, last_show_count,
  last_status, last_error, cooldown_until,
  false as verified,
  created_at, updated_at
from public.event_sources;

-- Repoint productions: add organization_id, backfill from source_id.
alter table public.productions
  add column organization_id uuid references public.organizations(id) on delete set null;

create index productions_organization_idx on public.productions (organization_id);

update public.productions
   set organization_id = source_id
 where source_id is not null;

-- productions.verified_org_id deliberately not backfilled - it only
-- pointed at the dropped filler rows.

alter table public.productions
  drop column source_id,
  drop column verified_org_id;

-- Repoint callboard_posts: add organization_id (no backfill needed,
-- only filler rows had verified_org_id set).
alter table public.callboard_posts
  add column organization_id uuid references public.organizations(id) on delete set null;

create index callboard_posts_organization_idx on public.callboard_posts (organization_id);

alter table public.callboard_posts
  drop column verified_org_id;

-- Drop old tables. event_sources first because its FK to verified_orgs
-- has to go before verified_orgs can be dropped.
drop table public.event_sources;
drop table public.verified_orgs;
