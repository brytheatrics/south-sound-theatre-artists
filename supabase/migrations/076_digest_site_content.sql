-- 076_digest_site_content.sql
-- Seed a site_content row for the new /digest page so its nav label
-- ("Digest") and any future masthead lede can be edited from
-- /admin/content without a code change. Mirrors the pattern used for
-- the other landing pages (directory, calendar, callboard, resources).

insert into public.site_content (slug, title, body_markdown)
values (
  'digest',
  'Digest',
  ''
)
on conflict (slug) do nothing;
