-- 046_productions_area.sql
-- Denormalise area onto productions so manual entries (no source) can
-- still be filtered by area on /calendar. Auto-pop'd productions get
-- their area_id from their source on every cron upsert; manual entries
-- get whatever area the admin picks. Backfills existing rows from their
-- source's area_id.

alter table public.productions
  add column if not exists area_id uuid references public.areas(id) on delete set null;

create index if not exists productions_area_idx
  on public.productions (area_id) where deleted_at is null and status = 'approved';

update public.productions
  set area_id = es.area_id
  from public.event_sources es
  where productions.source_id = es.id
    and productions.area_id is null;
