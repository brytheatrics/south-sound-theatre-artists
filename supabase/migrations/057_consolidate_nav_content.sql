-- 057_consolidate_nav_content.sql
-- Consolidate nav.X rows into the page-level rows added in 056. Each
-- landing page now has a single site_content row where:
--   - title = nav label (used by the top nav)
--   - body_markdown = masthead lede on the page itself
--
-- Old setup had nav.callboard / nav.calendar / nav.directory /
-- nav.resources holding only the title (body unused), which was
-- confusing in /admin/content - "why doesn't the body editor do
-- anything for these?" Cleaner to have one row per page that owns
-- both fields.
--
-- /theatres got its row in 056 directly. /resources didn't, since
-- there's no scrape data driving it - it gets seeded here.
--
-- Idempotent: re-running on a DB that's already had 057 applied is a
-- no-op since the nav.* rows are gone after the first run.

-- Carry the nav.* titles forward onto the unprefixed rows (preserving
-- any admin label customization). Done before the inserts/deletes so
-- COALESCE picks up whatever Lexi had set.
update public.site_content sc
   set title = nv.title
  from public.site_content nv
 where nv.slug = 'nav.' || sc.slug
   and sc.slug in ('callboard', 'calendar', 'directory')
   and nv.title is not null;

-- /resources didn't exist as a content row, only as nav.resources.
-- Seed a fresh row carrying the nav label as title + the current
-- hardcoded lede from the page.
insert into public.site_content (slug, title, body_markdown)
select
  'resources',
  coalesce((select title from public.site_content where slug = 'nav.resources'), 'Resources'),
  'A hand-curated library of links the South Sound theatre community might find useful. If something''s missing, [let us know](/contact).'
on conflict (slug) do nothing;

-- Drop the nav.* rows now that their data lives elsewhere.
delete from public.site_content where slug like 'nav.%';
