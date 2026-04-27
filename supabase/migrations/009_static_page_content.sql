-- 009_static_page_content.sql
-- Replace the placeholder bodies for the public-typographic pages with
-- the real (editable) copy, and add privacy / terms to the site_content
-- table so /admin/content can edit those too.
--
-- Lawyer review still required on privacy + terms before launch.

update public.site_content set
  title = 'About',
  body_markdown =
    '# A directory for us, by us.' || E'\n\n' ||
    'South Sound Theatre Artists is a free, community-run home for the actors, directors, designers, technicians, and stage managers working in the South Puget Sound.' || E'\n\n' ||
    '## Why this exists' || E'\n\n' ||
    'Theatre work in the South Sound mostly happens through word of mouth. That works until it doesn''t - newcomers can''t find their way in, and directors rebuild the same shortlists every season. This site is meant to make us all easier to find without putting anything behind a paywall or an account.' || E'\n\n' ||
    '## How it works' || E'\n\n' ||
    'Anyone can browse. Submitting a profile takes about five minutes and one email-verification click. An admin reviews each new profile and publishes it, usually within a day or two. Edits go through a magic link to your own email - no passwords, no recovery flows.' || E'\n\n' ||
    '## Who runs it' || E'\n\n' ||
    'The site is maintained by a single volunteer admin. Hosting, email, and image storage all run on free tiers. If it ever stops being free, the goal is to find another free way before charging anyone.'
where slug = 'about';

update public.site_content set
  title = 'Contact',
  body_markdown =
    '# Get in touch.' || E'\n\n' ||
    'Questions about the directory, callboard, or your profile? Drop a note and we''ll get back to you.' || E'\n\n' ||
    'For now, email **lexi@southsoundtheatreartists.com**. A proper contact form lands in the next update.'
where slug = 'contact';

update public.site_content set
  title = 'Support us',
  body_markdown =
    '# Help keep this free.' || E'\n\n' ||
    'The site runs on free tiers and volunteer time. If you''d like to help cover the eventual domain renewal or buy the admin a coffee, that keeps everything moving.' || E'\n\n' ||
    'Ko-fi tip jar coming soon. For now, the best way to support the project is to [add your profile](/submit) and tell other South Sound artists about it.'
where slug = 'support_us';

insert into public.site_content (slug, title, body_markdown) values
  ('privacy',
   'Privacy',
   '# Privacy.' || E'\n\n' ||
   '## What we collect' || E'\n\n' ||
   'The email address you use to submit a profile, the profile fields you fill in, and the headshot file (if you upload one). On public pages we don''t run analytics that profile individuals.' || E'\n\n' ||
   '## How we use it' || E'\n\n' ||
   'Profile fields appear on your public profile page and in directory search results. Your email is never displayed publicly - it''s used to send you your edit link and to route messages from the contact form.' || E'\n\n' ||
   '## Where it lives' || E'\n\n' ||
   'Profile data sits in a Supabase Postgres database. Headshots sit on Cloudinary. Outbound email goes through Resend.' || E'\n\n' ||
   '## How to remove it' || E'\n\n' ||
   'Use your magic-link edit page to unpublish or delete your profile, or email the admin and we''ll handle it.'),
  ('terms',
   'Terms',
   '# Terms.' || E'\n\n' ||
   '## Use of the site' || E'\n\n' ||
   'Browse and read whatever you like. Don''t scrape, spam, harass, or pretend to be someone you''re not. The admin reserves the right to remove any profile or post that breaks those.' || E'\n\n' ||
   '## Your content' || E'\n\n' ||
   'Profile content (text, headshot, links) belongs to you. By submitting, you grant the directory the right to display that content on the site and in associated promotional channels (e.g. featured-artist rotation). You can unpublish or delete your profile at any time.' || E'\n\n' ||
   '## Headshot rights' || E'\n\n' ||
   'By uploading a headshot you confirm you have the rights to use it. If a photographer credit is required, include it in your bio.' || E'\n\n' ||
   '## Liability' || E'\n\n' ||
   'The site is provided as-is. We do our best to keep it accurate and available, but make no guarantees about uptime or the conduct of listed artists or theatres.')
on conflict (slug) do nothing;
