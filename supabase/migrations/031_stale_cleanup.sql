-- 031_stale_cleanup.sql
-- Tracks the "still active?" ping state for stale-profile cleanup.
--
-- Flow (driven by scripts/stale-profile-cleanup.mjs):
--   1. profile.updated_at older than 18 months and stale_pinged_at null
--      -> send the "still in the area?" email, set stale_pinged_at=now()
--   2. stale_pinged_at older than 30 days and updated_at hasn't moved
--      since the ping -> soft-delete (set deleted_at=now())
--   3. (separately) profiles with deleted_at older than 30 days are
--      hard-deleted by the same cron - same retention policy as the
--      callboard / report soft-delete sweeps.
--
-- If the artist updates their profile after a ping, updated_at moves
-- forward and stale_pinged_at gets cleared by the magic-link edit flow
-- (or the next cron run sees updated_at > stale_pinged_at and skips).

alter table public.profiles
  add column if not exists stale_pinged_at timestamptz;

create index if not exists profiles_stale_pinged_idx
  on public.profiles (stale_pinged_at) where deleted_at is null;
