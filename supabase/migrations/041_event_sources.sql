-- 041_event_sources.sql
-- v2.x calendar: tracks the URL each org publishes their season at, plus
-- the cron job's bookkeeping (last successful run, hash for content
-- caching, status, cooldown for manual refresh).
--
-- One row per org we auto-pull from. Adapter strategy is stored as text
-- ('ai-generic', 'squarespace-json', etc) so we can extend without a
-- schema change. Phase 0 / 0.5 validated that 'ai-generic' alone covers
-- 16 of the original 26 orgs by pointing it at platform-aware URLs
-- (org marketing site, Arts People `?ticketing=<code>`, CSSTix root).

create table if not exists public.event_sources (
  id                  uuid primary key default gen_random_uuid(),

  -- Display + identity
  org_name            text not null,
  org_slug            text not null unique,

  -- Optional link back to a verified_orgs row when the same org also
  -- posts opportunities to the callboard. Null for auto-pop-only orgs.
  verified_org_id     uuid references public.verified_orgs(id) on delete set null,

  -- Where + how we extract
  source_url          text not null,
  adapter             text not null default 'ai-generic',
  notes               text,

  -- Cadence (days between automated runs). 30 = monthly default.
  -- Manual refresh button bypasses this; cron honours it.
  cadence_days        integer not null default 30,

  -- Active = include in cron walk. Lexi can pause an org without deleting
  -- the row (e.g. while its source URL is broken between seasons).
  active              boolean not null default true,

  -- Cache: last successful clean-HTML SHA-256. If next fetch hashes the
  -- same, we skip the AI call and just bump last_checked_at. Drops cost
  -- ~75% in steady state.
  last_hash           text,
  last_checked_at     timestamptz,
  last_successful_at  timestamptz,
  last_show_count     integer,

  -- Status: 'ok' (last run wrote shows), 'unchanged' (hash matched),
  -- 'empty' (run produced no shows - possibly stale URL), 'error' (last
  -- run threw). Lexi gets an alert when a row stays 'empty' / 'error'
  -- for >2 weeks.
  last_status         text not null default 'pending'
                        check (last_status in ('pending','ok','unchanged','empty','error')),
  last_error          text,

  -- Manual refresh cooldown. The "Refresh now" button in admin checks
  -- this and refuses if now() < cooldown_until. Default cooldown is
  -- 1 hour after a successful run.
  cooldown_until      timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists event_sources_active_idx
  on public.event_sources (active, cadence_days, last_checked_at);
create index if not exists event_sources_status_idx
  on public.event_sources (last_status);
create index if not exists event_sources_org_idx
  on public.event_sources (verified_org_id);

create trigger event_sources_set_updated_at
  before update on public.event_sources
  for each row execute function public.set_updated_at();

alter table public.event_sources enable row level security;

-- Sources are admin-only. No public read; the public calendar reads
-- productions / performances directly, not source config.
