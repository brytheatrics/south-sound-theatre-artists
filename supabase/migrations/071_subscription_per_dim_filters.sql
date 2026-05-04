-- 071_subscription_per_dim_filters.sql
--
-- Splits weekly-digest subscription filtering into four explicit
-- dimensions instead of one combined area filter:
--   - callboard_post_types       (already there, keep)
--   - callboard_area_ids         (NEW)
--   - calendar_category_ids      (NEW)
--   - calendar_area_ids          (renamed from area_ids)
--
-- Why split callboard areas from calendar areas: a subscriber may be
-- happy to *see* a show in Centralia but not commute there to *work*.
-- One dimension can't capture that.
--
-- Also adds preferences_updated_at, which the cron uses to detect
-- "new options added since you last edited" - the basis for the
-- digest's footer notice that nudges narrowed subscribers to the
-- manage page when admin adds a new type / area / category.
--
-- And adds callboard_posts.area_id, finally making callboard locations
-- consistent with the directory + calendar (which already use the
-- shared `areas` table). location text stays for venue / address
-- detail; area_id is the broad region the post belongs to.

-- 1. callboard_posts gets a proper area FK.
alter table public.callboard_posts
  add column if not exists area_id uuid references public.areas(id) on delete set null;

create index if not exists callboard_posts_area_idx
  on public.callboard_posts (area_id);

comment on column public.callboard_posts.area_id is
  'Region this post belongs to (Tacoma / Pierce, Olympia / Thurston, etc). Required at submit time going forward; existing rows pre-mig-071 have null until admin tags them via /admin/callboard. The cron treats null-area posts as universal so untagged posts still surface during the catch-up.';

-- 2. callboard_subscriptions filter dimensions.
alter table public.callboard_subscriptions
  rename column area_ids to calendar_area_ids;

alter index if exists callboard_subscriptions_area_ids_idx
  rename to callboard_subscriptions_calendar_area_ids_idx;

alter table public.callboard_subscriptions
  add column if not exists callboard_area_ids   uuid[] not null default '{}',
  add column if not exists calendar_category_ids uuid[] not null default '{}',
  add column if not exists preferences_updated_at timestamptz not null default now();

create index if not exists callboard_subscriptions_callboard_area_ids_idx
  on public.callboard_subscriptions using gin (callboard_area_ids)
  where unsubscribed_at is null;

create index if not exists callboard_subscriptions_calendar_category_ids_idx
  on public.callboard_subscriptions using gin (calendar_category_ids)
  where unsubscribed_at is null;

comment on column public.callboard_subscriptions.preferences_updated_at is
  'Set on every save (signup + manage). The cron compares admin-table created_at against this to detect options added since the subscriber last reviewed - drives the "new options have been added" footer notice on /callboard/subscribe/manage/[token].';
