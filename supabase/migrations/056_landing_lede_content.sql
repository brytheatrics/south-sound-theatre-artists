-- 056_landing_lede_content.sql
-- Mirrors the existing `home` row pattern (which controls the homepage
-- lede) for the other four landing pages: callboard, directory,
-- calendar, theatres. Seeds each with the current hardcoded copy so
-- the page reads identically until admin opens /admin/content and
-- tweaks something.
--
-- Body markdown supports inline links via [text](url), used here to
-- preserve the cross-page references in the lede paragraphs.

insert into public.site_content (slug, title, body_markdown)
values
  (
    'callboard',
    'The Callboard',
    'Auditions, designer and crew calls, and other opportunities for the South Sound theatre community. Posting is free - anyone can submit, and verified companies post immediately. Looking for upcoming shows? See [What''s Playing](/calendar).'
  ),
  (
    'directory',
    'Directory',
    'Browse, filter, and reach out. No account needed.'
  ),
  (
    'calendar',
    'What''s Playing',
    'Plays, musicals, staged readings, and special events. Dates can change - please confirm with the theatre''s website before heading out.'
  ),
  (
    'theatres',
    'Theatres',
    'Every company on our calendar lives here - from year-round professional houses to one-show-a-summer outdoor companies. Click into a theatre''s site for tickets, season info, or to reach their team directly.'
  )
on conflict (slug) do nothing;
