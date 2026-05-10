-- 100_profiles_launch_grace.sql
--
-- Launch-day grace period for bulk-imported profiles. The launch flow
-- is:
--   1. Admin runs scripts/send-launch-invitations.mjs which emails
--      every published profile that hasn't been invited yet. The
--      script stamps invited_at = now() on each row it emails.
--   2. Profiles stay live (published=true) for 30 days. The artist
--      can ignore the email and still appear in the directory.
--   3. T+27 cron stage sends a one-time "your profile will be hidden
--      in 3 days unless you fill in X, Y, Z" warning email.
--   4. T+30 cron stage auto-hides profiles that still have missing
--      required fields. Sets published=false + auto_hidden_incomplete=true
--      + admin_note explaining the reason.
--   5. When the artist edits + saves with all required fields present,
--      auto-republish fires (set published=true, clear
--      auto_hidden_incomplete) so they're back in the directory
--      without admin intervention.
--
-- Distinguishing auto_hidden_incomplete from manual admin unpublish
-- means re-publish only fires for profiles WE hid - admin's manual
-- unpublishes for moderation reasons stay unpublished.

alter table public.profiles
  add column if not exists invited_at timestamptz,
  add column if not exists auto_hidden_incomplete boolean not null default false,
  add column if not exists completion_warning_sent_at timestamptz;

create index if not exists profiles_invited_at_idx
  on public.profiles (invited_at)
  where invited_at is not null and deleted_at is null;

create index if not exists profiles_auto_hidden_incomplete_idx
  on public.profiles (auto_hidden_incomplete)
  where auto_hidden_incomplete = true;

comment on column public.profiles.invited_at is
  'Stamped when send-launch-invitations.mjs (or any future bulk-invite script) emails the artist. Drives the 30-day grace period for completion before auto-hide.';
comment on column public.profiles.auto_hidden_incomplete is
  'Set when the cron auto-hides a profile for missing required fields. Distinguishes from admin manual unpublish so the auto-republish on save only fires for profiles WE hid.';
comment on column public.profiles.completion_warning_sent_at is
  'Stamped when the T-3 "your profile will be hidden soon" warning email goes out. Prevents re-sending if the cron runs more than once.';
