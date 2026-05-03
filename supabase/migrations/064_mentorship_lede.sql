-- 064_mentorship_lede.sql
-- New /mentorship landing page surfaces the mentorship_offering /
-- mentorship_seeking arrays already on every profile. Add a content
-- row so admin can edit the masthead lede the same way they edit
-- other landing pages (callboard, calendar, theatres, etc.).
--
-- Title is the page header / nav label. Body is the lede paragraph
-- under the headline.

insert into public.site_content (slug, title, body_markdown)
values (
  'mentorship',
  'Mentorship',
  'Find a mentor or be one. Every artist on the directory can list disciplines they''re open to mentoring in or want to learn. Browse who''s offering, who''s looking, and reach out directly.'
)
on conflict (slug) do nothing;
