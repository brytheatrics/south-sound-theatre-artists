-- 002_seed.sql
-- Starter data for South Sound Theatre Artists v1.
--
-- All rows below are placeholders that Lexi can edit through the admin
-- panel after launch. They exist so a freshly-deployed environment has
-- something to render before the admin has logged in for the first time.
-- Every insert uses ON CONFLICT DO NOTHING so re-running the seed is safe.

-- =====================================================================
-- Disciplines (per PRODUCT_SPEC.md filter list)
-- =====================================================================
insert into public.disciplines (name, sort_order) values
  ('Actor',                10),
  ('Director',             20),
  ('Scenic Designer',      30),
  ('Lighting Designer',    40),
  ('Costume Designer',     50),
  ('Sound Designer',       60),
  ('Projection Designer',  70),
  ('Props Designer',       80),
  ('Stage Manager',        90),
  ('Choreographer',       100),
  ('Music Director',      110),
  ('Playwright',          120),
  ('Producer',            130),
  ('Technician',          140),
  ('Crew',                150),
  ('Other',               160)
on conflict (name) do nothing;

-- =====================================================================
-- Site content placeholders
-- =====================================================================
insert into public.site_content (slug, title, body_markdown) values
  ('home',
   'Welcome',
   '# Welcome to South Sound Theatre Artists' || E'\n\n' ||
   'Replace this copy from the admin panel.'),

  ('about',
   'About',
   '# About' || E'\n\n' ||
   'Replace this copy from the admin panel.'),

  ('support_us',
   'Support Us',
   '# Support Us' || E'\n\n' ||
   'Replace this copy from the admin panel.'),

  ('contact',
   'Contact',
   '# Contact' || E'\n\n' ||
   'Replace this copy from the admin panel.'),

  ('footer',
   null,
   'South Sound Theatre Artists. Replace this footer text from the admin panel.')
on conflict (slug) do nothing;

-- =====================================================================
-- Email templates
-- Variables in {{double_braces}} are substituted by the sendEmail wrapper
-- at send time. The description column tells Lexi which variables each
-- template supports.
-- =====================================================================
insert into public.email_templates (slug, subject, body_markdown, description) values
  ('email_verification',
   'Verify your email - South Sound Theatre Artists',
   'Hi {{name}},' || E'\n\n' ||
   'Click the link below to verify your email address and finish your profile submission. This link expires in 24 hours.' || E'\n\n' ||
   '{{verify_url}}',
   'Variables: {{name}}, {{verify_url}}'),

  ('magic_link',
   'Your edit link - South Sound Theatre Artists',
   'Hi {{name}},' || E'\n\n' ||
   'Use the link below to edit your profile. It expires in 24 hours and can only be used once.' || E'\n\n' ||
   '{{edit_url}}',
   'Variables: {{name}}, {{edit_url}}'),

  ('magic_link_resend',
   'Your new edit link - South Sound Theatre Artists',
   'Hi {{name}},' || E'\n\n' ||
   'Here is a fresh link to edit your profile, as requested. It expires in 24 hours and can only be used once.' || E'\n\n' ||
   '{{edit_url}}',
   'Variables: {{name}}, {{edit_url}}'),

  ('rejection',
   'About your profile submission',
   'Hi {{name}},' || E'\n\n' ||
   'Thanks for submitting your profile to South Sound Theatre Artists. Unfortunately we are not able to publish it as submitted.' || E'\n\n' ||
   'Reason: {{reason}}' || E'\n\n' ||
   'You are welcome to revise and resubmit.',
   'Variables: {{name}}, {{reason}}'),

  ('contact_routed',
   'New message from the South Sound Theatre Artists directory',
   'Hi {{recipient_name}},' || E'\n\n' ||
   'Someone reached out via your profile.' || E'\n\n' ||
   'From: {{sender_name}} <{{sender_email}}>' || E'\n\n' ||
   'Message:' || E'\n' ||
   '{{message}}' || E'\n\n' ||
   'Reply directly to this email to respond.',
   'Variables: {{recipient_name}}, {{sender_name}}, {{sender_email}}, {{message}}'),

  ('admin_2fa',
   'Your admin login code',
   'Your South Sound Theatre Artists admin login code is:' || E'\n\n' ||
   '{{code}}' || E'\n\n' ||
   'This code expires in 10 minutes. If you did not request it, ignore this email and consider rotating the admin password.',
   'Variables: {{code}}'),

  ('daily_digest',
   'South Sound Theatre Artists - daily admin digest',
   'You have items waiting in the admin queue:' || E'\n\n' ||
   '- {{pending_submissions}} pending profile submission(s)' || E'\n' ||
   '- {{flagged_edits}} flagged edit(s)' || E'\n' ||
   '- {{open_reports}} open report(s)' || E'\n\n' ||
   'View the queue: {{admin_url}}',
   'Variables: {{pending_submissions}}, {{flagged_edits}}, {{open_reports}}, {{admin_url}}')
on conflict (slug) do nothing;
