-- 028_banner_callboard.sql
-- Lets the announcement banner pull in callboard posts as additional
-- rotating messages alongside the admin-typed body.
--
-- include_all_callboard:        cycle through every approved + published
--                               callboard post in the banner.
-- include_callboard_post_ids:   explicit list of callboard post ids to
--                               include (used when include_all_callboard
--                               is false).
--
-- The public layout reads these alongside body_markdown and assembles a
-- single banner-items array for the AnnouncementBanner rotator.

alter table public.announcement_banner
  add column if not exists include_all_callboard boolean not null default false,
  add column if not exists include_callboard_post_ids uuid[] not null default '{}';
