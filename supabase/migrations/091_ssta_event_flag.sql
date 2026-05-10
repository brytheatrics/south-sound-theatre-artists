-- 091_ssta_event_flag.sql
--
-- Adds `is_ssta_event` to productions + callboard_posts so admin can
-- tag entries that SSTA itself is hosting / sponsoring (mixers,
-- workshops, panels, partnership events). Tagged entries sort to the
-- top of their group on /calendar, /callboard, and in the weekly
-- digest, with a small "SSTA" badge surfaced to the public.
--
-- Admin-only flip: the public submission forms don't expose this. If
-- a public submitter sets is_ssta_event=true via crafted form data,
-- the server-side handlers ignore the field on submit. Admin sets it
-- via the /admin/calendar/[id]/edit and /admin/callboard/[id]/edit
-- editors.

alter table public.productions
  add column if not exists is_ssta_event boolean not null default false;

alter table public.callboard_posts
  add column if not exists is_ssta_event boolean not null default false;

create index if not exists productions_ssta_idx
  on public.productions (is_ssta_event)
  where is_ssta_event = true;

create index if not exists callboard_posts_ssta_idx
  on public.callboard_posts (is_ssta_event)
  where is_ssta_event = true;

comment on column public.productions.is_ssta_event is
  'Admin-tagged: SSTA itself is hosting/sponsoring this production. Sorts first within each day on the public calendar; renders with an "SSTA" badge.';

comment on column public.callboard_posts.is_ssta_event is
  'Admin-tagged: SSTA itself is posting this opportunity. Sorts first within each post_type on the public callboard + digest; renders with an "SSTA" badge.';
