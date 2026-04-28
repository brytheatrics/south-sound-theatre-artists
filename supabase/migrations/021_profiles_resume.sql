-- 021_profiles_resume.sql
-- v1.1 first feature: artists can upload a resume PDF that lives on
-- Cloudinary (raw resource) and is linked from their public profile.
-- The on-site structured resume builder lands later; for now this gives
-- artists a way to attach the PDF they already have.

alter table public.profiles
  add column resume_url text;

alter table public.pending_submissions
  add column resume_url text;
