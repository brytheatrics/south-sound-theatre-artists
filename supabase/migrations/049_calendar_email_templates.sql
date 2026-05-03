-- 049_calendar_email_templates.sql
-- Email templates for the v2.x /calendar/submit flow. Mirrors the
-- callboard template patterns (mig 026). All admin-editable from
-- /admin/templates.

insert into public.email_templates (slug, subject, body_markdown, description) values

  ('calendar_verify',
   'Confirm your performance submission - South Sound Theatre Artists',
   'Hi {{name}},' || E'\n\n' ||
   'Thanks for submitting "{{title}}" to the South Sound Theatre Artists calendar. Click the link below to confirm your email and send it for review.' || E'\n\n' ||
   '{{verify_url}}' || E'\n\n' ||
   'This link expires in 24 hours. If you did not submit a performance, you can ignore this email.',
   'Sent when /calendar/submit creates a pending submission. Variables: {{name}}, {{title}}, {{verify_url}}'),

  ('calendar_approved',
   'Your performance is on the calendar - South Sound Theatre Artists',
   'Hi {{name}},' || E'\n\n' ||
   '"{{title}}" is now live on the South Sound Theatre Artists calendar.' || E'\n\n' ||
   '{{calendar_url}}' || E'\n\n' ||
   'If you need to make changes, reply to this email and we will take care of it.',
   'Sent when admin approves a calendar submission. Variables: {{name}}, {{title}}, {{calendar_url}}'),

  ('calendar_rejected',
   'About your performance submission - South Sound Theatre Artists',
   'Hi {{name}},' || E'\n\n' ||
   'Thanks for submitting "{{title}}" to the South Sound Theatre Artists calendar. Unfortunately we were not able to approve it at this time.' || E'\n\n' ||
   'Reason: {{reason}}' || E'\n\n' ||
   'If you have questions or would like to resubmit, feel free to reply to this email.',
   'Sent when admin rejects a calendar submission. Variables: {{name}}, {{title}}, {{reason}}')

on conflict (slug) do nothing;
