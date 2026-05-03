-- 053_marquee_calendar.sql
-- Extends marquee_settings so the homepage ticker can mix in upcoming
-- calendar productions alongside open callboard posts. Mirrors the
-- existing callboard pattern: cycle-all flag plus an optional
-- admin-picked subset.
--
-- Defaults: include_all_calendar = true so the moment v2.x calendar
-- populates, productions show up on the marquee without any admin
-- action. Lexi can switch to a curated set from /admin/marquee.

alter table public.marquee_settings
  add column if not exists include_all_calendar       boolean not null default true,
  add column if not exists include_calendar_production_ids uuid[] not null default '{}';

comment on column public.marquee_settings.include_all_calendar is
  'When true, every approved upcoming production cycles through the marquee. When false, only the IDs in include_calendar_production_ids show.';
