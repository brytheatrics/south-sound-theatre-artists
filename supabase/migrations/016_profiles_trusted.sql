-- 016_profiles_trusted.sql
-- Adds a `trusted` flag to profiles. Phase B of the trust system will use
-- this to decide whether magic-link edits apply directly (trusted) or
-- queue in flagged_edits for admin re-approval (untrusted).
--
-- Existing approved profiles seed to trusted=true since they already
-- passed admin review once. New submissions land at trusted=false.

alter table public.profiles
  add column trusted boolean not null default false;

-- One-time backfill for already-approved profiles.
update public.profiles set trusted = true where deleted_at is null;

create index if not exists profiles_trusted_idx
  on public.profiles (trusted);
