-- 011_home_content.sql
-- Replace the placeholder home body with the actual lede copy. The
-- homepage now renders this in the hero area; admins can edit it from
-- /admin/content.

update public.site_content set
  title = 'Home',
  body_markdown =
    'A free, community-run directory of theatre artists from the South Puget Sound. No accounts to browse. Five-minute submission to be listed. *You belong here.*'
where slug = 'home';
