-- 052_theatre_metadata.sql
-- Powers the public /theatres directory: each event_source row gets
-- public-facing metadata (a short description, a homepage URL distinct
-- from the season-specific source_url, an optional contact email, and
-- an optional logo). All nullable so the page renders gracefully even
-- when a row is half-filled.
--
-- The /theatres seed script populates these from a vetted offline
-- research pass; admin can override any field at /admin/calendar/sources
-- to keep the public page accurate without a code change.

alter table public.event_sources
  add column if not exists description text,
  add column if not exists homepage_url text,
  add column if not exists public_email text,
  add column if not exists logo_url text;

comment on column public.event_sources.description is
  'Public-facing 1-2 sentence description shown on /theatres.';
comment on column public.event_sources.homepage_url is
  'Public homepage. Distinct from source_url, which often points at a season / tickets page.';
comment on column public.event_sources.public_email is
  'Optional public contact email shown on /theatres.';
comment on column public.event_sources.logo_url is
  'Optional logo (Cloudinary or stable external URL).';
