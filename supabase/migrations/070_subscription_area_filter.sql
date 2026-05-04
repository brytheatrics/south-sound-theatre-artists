-- 070_subscription_area_filter.sql
--
-- Adds an `area_ids` column to callboard_subscriptions so subscribers
-- can scope the calendar slice of their weekly digest to specific
-- regions (e.g. "just performances in Pierce County"). Empty array =
-- no filter / all areas, mirroring the existing convention on
-- post_types + disciplines.
--
-- Stored as uuid[] referencing areas.id (rather than area names) so
-- a future area rename via /admin/submit-form doesn't silently break
-- existing subscriptions.

alter table public.callboard_subscriptions
  add column if not exists area_ids uuid[] not null default '{}';

-- GIN index supports the `&&` (array overlap) and `= any(...)` queries
-- the cron will use when filtering by area. Partial index keeps the
-- working set small - we only need to look up active subscriptions.
create index if not exists callboard_subscriptions_area_ids_idx
  on public.callboard_subscriptions using gin (area_ids)
  where unsubscribed_at is null;

comment on column public.callboard_subscriptions.area_ids is
  'When non-empty, the digest cron narrows the calendar productions slice to performances in these areas. Empty array = no filter (all areas).';
