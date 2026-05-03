-- 042_productions_calendar_columns.sql
-- v2.x calendar: extend `productions` with the structured fields the
-- auto-populated calendar needs. The existing v1.2 callboard-side-effect
-- inserts continue working - new columns are nullable with sensible
-- defaults.
--
-- Per the v2.x product decision: callboard becomes "Opportunities" only
-- (auditions, designer/crew calls). Anything performance-shaped lives on
-- the calendar. Existing 'production' callboard posts will be migrated
-- to manual calendar entries by a separate one-shot script before we
-- drop the post type from the callboard form.

alter table public.productions
  add column if not exists category_id      uuid references public.event_categories(id) on delete set null,
  add column if not exists source_id        uuid references public.event_sources(id)    on delete set null,
  add column if not exists verified_org_id  uuid references public.verified_orgs(id)    on delete set null,

  -- Structured run window. show_dates (legacy text) stays around for
  -- displaying free-form copy when someone enters it manually.
  add column if not exists run_start        date,
  add column if not exists run_end          date,

  add column if not exists description      text,
  add column if not exists detail_url       text,
  add column if not exists status           text not null default 'approved'
                            check (status in ('pending_review','approved','rejected')),
  add column if not exists rejection_reason text,
  add column if not exists reviewed_at      timestamptz,
  add column if not exists reviewed_by      text,
  add column if not exists deleted_at       timestamptz;

-- Existing callboard-driven rows are implicitly approved. Backfill the
-- status column for any pre-migration rows that landed before the
-- column existed (default 'approved' applies to inserts after this
-- migration; this catch-up is idempotent).
update public.productions
  set status = 'approved'
  where status is null;

create index if not exists productions_status_idx
  on public.productions (status, run_start) where deleted_at is null;
create index if not exists productions_run_window_idx
  on public.productions (run_start, run_end) where deleted_at is null and status = 'approved';
create index if not exists productions_source_idx
  on public.productions (source_id);
create index if not exists productions_org_idx
  on public.productions (verified_org_id);
create index if not exists productions_category_idx
  on public.productions (category_id);
create index if not exists productions_deleted_idx
  on public.productions (deleted_at);

alter table public.productions enable row level security;

create policy "Public can read approved productions"
  on public.productions for select
  to anon, authenticated
  using (status = 'approved' and deleted_at is null);
