-- 050_productions_admin_lock.sql
-- Admin-edit lock for productions. When the admin saves edits or
-- soft-deletes an auto-pop'd production, we set admin_edited_at. The
-- cron's upsert skips any production with this set - it neither
-- updates the metadata nor replaces performances. Soft-deleted +
-- locked rows also resist reanimation: the cron sees them, recognises
-- the lock, and skips creating a new one.
--
-- This solves three operator concerns:
--   1. Admin renames a show, next cron run reverts the rename: blocked
--   2. Admin re-categorises ("Harlequin Miscast" -> Fundraiser):
--      already preserved by COALESCE on category_id, but now also
--      protected against any future cron schema change.
--   3. Admin removes a junk row, next cron run recreates it: blocked.
--
-- To "release" a row back to cron management, admin clears
-- admin_edited_at (UI offers this as "Re-enable auto-sync"). For now
-- there's no UI button - manual clear via DB or admin re-edit, then
-- next cron sees the timestamp moved later than... wait, the cron only
-- checks NOT NULL, so clearing admin_edited_at = NULL is the unlock
-- mechanism. (UI for this is a follow-up.)

alter table public.productions
  add column if not exists admin_edited_at timestamptz;

create index if not exists productions_admin_edited_idx
  on public.productions (admin_edited_at);
