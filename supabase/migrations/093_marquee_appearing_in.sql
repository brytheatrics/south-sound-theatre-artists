-- 093_marquee_appearing_in.sql
--
-- Extends marquee_settings with a third dimension: artists currently
-- appearing in / working on a production. This pulls from
-- production_credits joined with productions whose run window includes
-- today, projecting one marquee item per credited published artist.
--
-- Default: on. The moment any production has cast/production credits
-- and is in run window, those artists surface on the marquee. Lexi
-- can flip off from /admin/marquee.

alter table public.marquee_settings
  add column if not exists include_appearing_in boolean not null default true;

comment on column public.marquee_settings.include_appearing_in is
  'When true, the homepage marquee includes one item per published artist currently credited on a production whose run window contains today. Cast credits link the artist; production-team credits do too. Toggle off from /admin/marquee.';
