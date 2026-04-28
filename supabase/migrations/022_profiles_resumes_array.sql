-- 022_profiles_resumes_array.sql
-- Pivot: a single resume_url column won't hold up because theatre artists
-- typically keep multiple resumes (acting, directing, design, tech...) and
-- switch them per audition. Replace with a jsonb array so each profile can
-- carry as many as they need.
--
-- Each entry shape: { "label": "Acting", "url": "https://res.cloudinary..." }

alter table public.profiles
  drop column if exists resume_url;
alter table public.pending_submissions
  drop column if exists resume_url;

alter table public.profiles
  add column resumes jsonb not null default '[]'::jsonb;
alter table public.pending_submissions
  add column resumes jsonb not null default '[]'::jsonb;
