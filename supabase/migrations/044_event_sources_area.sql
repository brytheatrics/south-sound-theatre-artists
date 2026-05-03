-- 044_event_sources_area.sql
-- v2.x calendar: tag each event_source with its geographic area so the
-- public calendar can filter by region the same way /directory does.
-- Reuses the existing `areas` table (Tacoma area, Olympia area, Gig
-- Harbor / Kitsap, South King County, Other South Sound, Other) so the
-- two surfaces always agree on the area list.

alter table public.event_sources
  add column if not exists area_id uuid references public.areas(id) on delete set null;

create index if not exists event_sources_area_idx
  on public.event_sources (area_id);
