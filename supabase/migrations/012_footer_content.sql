-- 012_footer_content.sql
-- Replace the footer placeholder with the live tagline so /admin/content
-- can edit it. Renders inline alongside the SSTA wordmark.

update public.site_content set
  title = 'Footer',
  body_markdown = 'South Sound Theatre Artists · 2026'
where slug = 'footer';
