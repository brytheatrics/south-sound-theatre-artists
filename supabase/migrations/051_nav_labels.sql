-- 051_nav_labels.sql
-- Wire the public-facing nav labels through site_content so Lexi can
-- rename "What's Playing" / "Opportunities" / "Directory" / "Resources"
-- without a code change. URLs (/calendar, /callboard, etc.) stay the
-- same - this is purely the human-readable label.
--
-- Stored as site_content rows with the label in the `title` field;
-- body_markdown stays empty since these aren't full pages, just
-- labels. Lexi edits at /admin/content the same way she edits other
-- copy. The naming convention "nav.<slug>" namespaces these rows so
-- they're easy to spot in the admin list.

insert into public.site_content (slug, title, body_markdown)
values
  ('nav.directory', 'Directory',     ''),
  ('nav.calendar',  'What''s Playing', ''),
  ('nav.callboard', 'Opportunities', ''),
  ('nav.resources', 'Resources',     '')
on conflict (slug) do nothing;
