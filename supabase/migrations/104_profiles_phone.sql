-- 104_profiles_phone.sql
--
-- Adds an optional phone number to profiles. Public-private:
-- shown to the artist on their own /edit/[token], to admin in
-- /admin/profiles/[id]/edit, and collected on the public /submit form,
-- but NEVER rendered on /artists/[slug], /directory, /theatres,
-- the marquee, the digest, the sitemap, or any indexable surface.
--
-- Why now: a future casting-tool release will route callbacks /
-- offers to artists by phone. Adding the field early means existing
-- artists can fill in their numbers gradually, so casting-launch day
-- doesn't require a "everyone please add your phone" email blast.
-- No casting code is being added now - this just provisions the field.
--
-- Trust treatment: phone is a "minor field" today (like pronouns or
-- area), so untrusted artists' phone updates apply directly without
-- queueing in flagged_edits. NOTE FOR CASTING-TOOL DAY: when phone
-- becomes load-bearing for callbacks, an attacker who hijacks an
-- account could rewrite phone to impersonate the artist to theatres.
-- Revisit the trust gate at that point - phone may need to escalate
-- to a flagged-edits-gated field for untrusted profiles.

alter table public.profiles
  add column if not exists phone text;

-- Mirror on pending_submissions so the public submit form can carry
-- the field through email-verification + admin-approve. The approve
-- handler copies pending_submissions.phone -> profiles.phone.
alter table public.pending_submissions
  add column if not exists phone text;

-- No index. Phone is never used as a search key or join key today
-- (and won't be in v2 either - casting tool will key by profile_id).

comment on column public.profiles.phone is
  'Optional artist contact phone. Never rendered publicly. Used by '
  'theatres in casting/callback workflows (future).';
comment on column public.pending_submissions.phone is
  'Optional submitter phone, copied to profiles.phone on approve.';
