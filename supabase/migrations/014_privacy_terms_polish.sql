-- 014_privacy_terms_polish.sql
-- Polish pre-launch privacy + terms. Adds:
--   - Last-updated date
--   - Admin contact email (lexi@southsoundtheatreartists.com)
--   - Cookies note (privacy)
--   - Minors clause (terms)
--   - Governing law (terms)
--   - Changes-to-these-terms note (terms)
-- Lexi can fine-tune any of this through /admin/content.

update public.site_content set
  body_markdown =
    '# *Privacy*.' || E'\n\n' ||
    'What we collect, how we use it, and how to remove it.' || E'\n\n' ||
    '_Last updated: April 27, 2026._' || E'\n\n' ||
    '## What we collect' || E'\n\n' ||
    'The email address you use to submit a profile, the profile fields you fill in, and the headshot file (if you upload one). On public pages we don''t run analytics that profile individuals.' || E'\n\n' ||
    '## How we use it' || E'\n\n' ||
    'Profile fields appear on your public profile page and in directory search results. Your email is never displayed publicly - it''s used to send you your edit link and to route messages from the contact form.' || E'\n\n' ||
    '## Cookies' || E'\n\n' ||
    'We don''t set tracking or analytics cookies. The only cookie this site sets is a session cookie for admin login, which applies only to the admin - not to general visitors.' || E'\n\n' ||
    '## Where it lives' || E'\n\n' ||
    'Profile data sits in a Supabase Postgres database. Headshots sit on Cloudinary. Outbound email goes through Resend.' || E'\n\n' ||
    '## How to remove it' || E'\n\n' ||
    'Use your magic-link edit page to unpublish or delete your profile, or email **lexi@southsoundtheatreartists.com** and we''ll handle it.'
where slug = 'privacy';

update public.site_content set
  body_markdown =
    '# *Terms*.' || E'\n\n' ||
    'House rules for using the directory.' || E'\n\n' ||
    '_Last updated: April 27, 2026._' || E'\n\n' ||
    '## Use of the site' || E'\n\n' ||
    'Browse and read whatever you like. Don''t scrape, spam, harass, or pretend to be someone you''re not. The admin reserves the right to remove any profile or post that breaks those.' || E'\n\n' ||
    '## Your content' || E'\n\n' ||
    'Profile content (text, headshot, links) belongs to you. By submitting, you grant the directory the right to display that content on the site and in associated promotional channels (e.g. featured-artist rotation). You can unpublish or delete your profile at any time.' || E'\n\n' ||
    '## Headshot rights' || E'\n\n' ||
    'By uploading a headshot you confirm you have the rights to use it. If a photographer credit is required, include it in your bio.' || E'\n\n' ||
    '## Minors' || E'\n\n' ||
    'Performers under 18 are welcome. A parent or guardian must submit and manage the profile on the artist''s behalf - the email on file should be the guardian''s until the artist turns 18, since that''s where edit links go.' || E'\n\n' ||
    '## Liability' || E'\n\n' ||
    'The site is provided as-is. We do our best to keep it accurate and available, but make no guarantees about uptime or the conduct of listed artists or theatres.' || E'\n\n' ||
    '## Governing law' || E'\n\n' ||
    'These terms are governed by the laws of the State of Washington, USA.' || E'\n\n' ||
    '## Changes to these terms' || E'\n\n' ||
    'We may update these terms from time to time. Continued use of the site after an update means you accept the new version. Significant changes will be noted on the homepage when reasonable.' || E'\n\n' ||
    '## Contact' || E'\n\n' ||
    'Questions about these terms? Email **lexi@southsoundtheatreartists.com**.'
where slug = 'terms';
