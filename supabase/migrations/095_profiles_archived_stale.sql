-- 095_profiles_archived_stale.sql
--
-- Distinguishes "auto-archived because the artist didn't respond to a
-- stale-profile ping" from "admin clicked Delete." Both still go
-- through the same soft-delete (deleted_at + published=false) but only
-- admin-clicked deletes hard-purge after 30 days. Stale-archived
-- profiles stick around indefinitely so the artist can come back and
-- get reactivated rather than starting from scratch.
--
-- Behaviour change in scripts/stale-profile-cleanup.mjs:
--   - Stage 2 (auto-archive non-responders) now stamps archived_stale=true
--   - Stage 3 (30-day trash purge) excludes archived_stale=true rows
-- The /admin/profiles/trash UI surfaces a "Stale" badge so admin can
-- tell why a row is hidden + know not to expect auto-purge.

alter table public.profiles
  add column if not exists archived_stale boolean not null default false;

create index if not exists profiles_archived_stale_idx
  on public.profiles (archived_stale)
  where archived_stale = true;

comment on column public.profiles.archived_stale is
  'Set to true when the stale-profile cron auto-archives a profile that did not respond to the 18-month ping. Admin-clicked deletes leave it false. The cron''s hard-purge stage skips rows where this is true so stale-archived profiles persist indefinitely (recoverable from /admin/profiles/trash).';
