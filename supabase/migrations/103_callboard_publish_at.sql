-- 103_callboard_publish_at.sql
--
-- Adds scheduled-publish support to the callboard. A submitter can pick
-- a future post date so a production manager can queue up a season's
-- worth of auditions in one sitting. Defaults to now() so the existing
-- "submit and post immediately" flow keeps working without code changes
-- to the verification handler - a row inserted without an explicit
-- publish_at goes live the moment status flips to approved.
--
-- The public /callboard list, the /digest page, and the weekly digest
-- cron all gate on publish_at <= now() so future-scheduled posts stay
-- hidden until their date arrives. The cron's "new this week" filter
-- also switches from created_at > since to publish_at > since so a
-- post created today but scheduled for next Friday surfaces in the
-- digest the week it actually goes live, not the week it was drafted.

alter table public.callboard_posts
  add column if not exists publish_at timestamptz not null default now();

-- Used by the public list + digest queries to filter out scheduled-
-- but-not-yet-live posts. status + published columns are already
-- indexed, so a partial index keyed on publish_at is the cheap add.
create index if not exists callboard_posts_publish_at_idx
  on public.callboard_posts (publish_at)
  where status = 'approved' and published = true and deleted_at is null;
