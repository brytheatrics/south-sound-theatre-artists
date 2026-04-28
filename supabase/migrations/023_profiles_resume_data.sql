-- 023_profiles_resume_data.sql
-- v1.1: structured resume sections (credits, training, skills) stored as
-- jsonb on profiles + pending_submissions. The shape is validated and
-- normalised in the server-side parser (lib/server/resume.ts), not at
-- the DB level - the schema stays flexible so we can add discipline-
-- specific sections later without another migration.

alter table public.profiles
  add column resume_data jsonb not null default '{}'::jsonb;

alter table public.pending_submissions
  add column resume_data jsonb not null default '{}'::jsonb;
