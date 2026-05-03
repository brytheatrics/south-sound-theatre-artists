-- 054_profiles_minor.sql
-- Minor profile system: under-18 artists are listed via a parent /
-- guardian-managed profile. The submitted contact email and all
-- magic-link traffic route to the guardian, the headshot is suppressed
-- on the public profile, and the contact form on /artists/{slug}
-- shows a "messages go to a parent / guardian" notice.
--
-- We don't store an exact birth date - just a boolean. When the artist
-- turns 18, the admin (or the artist themselves via parent-mediated
-- magic link) flips `is_minor` to false. This avoids COPPA + general
-- minor-PII concerns of holding a birth date for years.
--
-- The submit form gathers guardian_email/guardian_name; the same fields
-- live on pending_submissions so they survive the email-verify ->
-- admin-approve -> publish pipeline.

alter table public.profiles
  add column if not exists is_minor       boolean not null default false,
  add column if not exists guardian_email citext,
  add column if not exists guardian_name  text;

-- Check: when is_minor=true, guardian_email must be set. (Both old and
-- new rows: existing profiles default is_minor=false so the constraint
-- doesn't apply retroactively.)
alter table public.profiles
  drop constraint if exists profiles_minor_requires_guardian;
alter table public.profiles
  add constraint profiles_minor_requires_guardian
    check (is_minor = false or guardian_email is not null);

alter table public.pending_submissions
  add column if not exists is_minor       boolean not null default false,
  add column if not exists guardian_email citext,
  add column if not exists guardian_name  text;

alter table public.pending_submissions
  drop constraint if exists pending_submissions_minor_requires_guardian;
alter table public.pending_submissions
  add constraint pending_submissions_minor_requires_guardian
    check (is_minor = false or guardian_email is not null);

-- Index for the admin queue (so /admin/profiles can flag minor rows).
create index if not exists profiles_is_minor_idx
  on public.profiles (is_minor) where is_minor = true;

comment on column public.profiles.is_minor is
  'True when the artist is under 18. Headshot is suppressed publicly and all email routing uses guardian_email.';
comment on column public.profiles.guardian_email is
  'Parent / guardian email. Required when is_minor=true. Used for magic-link edits + contact-form routing.';
comment on column public.profiles.guardian_name is
  'Optional parent / guardian display name (shown on contact form: "Messages go to <name>").';
