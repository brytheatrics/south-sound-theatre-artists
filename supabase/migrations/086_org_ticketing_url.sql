-- 086_org_ticketing_url.sql
--
-- Some orgs route ticket sales through a separate URL (Ludus,
-- OvationTix, etc.) that isn't the same as their homepage. The
-- monthly auto-sync can't extract a per-show ticketing link for
-- those theatres, but we can store the org-wide ticketing site
-- and link to it from /calendar/[id] as a fallback.
--
-- Display priority on the production page:
--   1. production.detail_url (per-show ticket link if known)
--   2. organizations.ticketing_url (org-wide tickets page)
--   3. organizations.homepage_url (last resort)

alter table public.organizations
  add column ticketing_url text;
