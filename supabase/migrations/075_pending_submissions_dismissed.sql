-- 075_pending_submissions_dismissed.sql
-- Add a `dismissed_at` column to pending_submissions so admin can hide
-- stale "awaiting email verification" rows from the main /admin panel
-- without deleting them outright. Dismissed rows still show under a
-- "Dismissed" sub-panel and can be restored or hard-deleted from there.
--
-- Two distinct admin actions, hence two columns of behavior:
--   dismissed_at IS NULL  -> visible on the main awaiting-verification list
--   dismissed_at IS NOT NULL -> visible only in the dismissed sub-panel
--   row gone from DB entirely -> hard-deleted (used for obvious spam)

alter table public.pending_submissions
  add column if not exists dismissed_at timestamptz;

-- Index helps the admin page filter both lists efficiently.
create index if not exists pending_submissions_dismissed_at_idx
  on public.pending_submissions (dismissed_at)
 where status = 'pending_email';
