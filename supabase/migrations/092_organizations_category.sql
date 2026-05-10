-- 092_organizations_category.sql
--
-- Adds a `category` column on organizations so future expansion to
-- non-theatre disciplines (opera, ballet, symphony, etc.) doesn't
-- require a backfill migration when it happens. Today every existing
-- row is a producing theatre company; the default 'theatre' captures
-- that. When Lexi starts adding e.g. Tacoma Opera or Tacoma City
-- Ballet, those rows are tagged at insert time and the new
-- per-category landing pages (/opera, /ballet, ...) will be ready to
-- consume the data.
--
-- Single-value (not multi-tag): KISS for v1. If later we want
-- "company that operates both as a theatre and a youth program",
-- multi-tag is a follow-up migration.

alter table public.organizations
  add column if not exists category text not null default 'theatre'
  check (category in (
    'theatre',
    'opera',
    'ballet',
    'symphony',
    'youth',
    'venue',
    'other'
  ));

create index if not exists organizations_category_idx
  on public.organizations (category)
  where deleted_at is null;

comment on column public.organizations.category is
  'Discipline grouping. Drives which per-category landing page (/theatres, /opera, /ballet, ...) the org appears on. Defaults to ''theatre'' for the existing seeded rows. Add new values via migration.';
