-- 096_profiles_admin_note.sql
--
-- Free-form admin-only note on profiles. Use case: admin A hides
-- someone for offensive content, admin B sees the hidden row later
-- and needs to know why. The note is shown wherever admin views the
-- profile (edit page, trash) and is never exposed to the public.
--
-- Stamped by:
--   - Admin manually entering text on /admin/profiles/[id]/edit
--   - The stale-cleanup cron when it auto-archives a non-responder
--     ("Auto-archived: 18-month ping, no response on YYYY-MM-DD")

alter table public.profiles
  add column if not exists admin_note text;

comment on column public.profiles.admin_note is
  'Admin-only context note about this profile. Use to explain why a profile is unpublished or in trash so other admins understand the state. Never exposed to public surfaces.';
