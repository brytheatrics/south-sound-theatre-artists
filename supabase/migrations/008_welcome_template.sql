-- 008_welcome_template.sql
-- Email template fired when admin approves a submission. Carries the
-- public profile URL plus a single-use magic link for the artist's first
-- edit.

insert into public.email_templates (slug, subject, body_markdown, description) values
  ('welcome',
   'Your profile is live - South Sound Theatre Artists',
   'Hi {{name}},' || E'\n\n' ||
   'Welcome to South Sound Theatre Artists. Your profile is now live at:' || E'\n' ||
   '{{profile_url}}' || E'\n\n' ||
   'Use this link to edit your profile. It expires in 24 hours and can only be used once - request a fresh one from the site any time you need to make changes.' || E'\n\n' ||
   '{{edit_url}}',
   'Variables: {{name}}, {{profile_url}}, {{edit_url}}')
on conflict (slug) do nothing;
