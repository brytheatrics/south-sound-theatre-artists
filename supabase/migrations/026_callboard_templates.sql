-- 026_callboard_templates.sql
-- Email templates for v1.2 callboard flows.
-- Variables use {{double_brace}} syntax, substituted server-side.

insert into public.email_templates (slug, subject, body_markdown, description) values

  ('callboard_verify',
   'Confirm your callboard post - South Sound Theatre Artists',
   'Hi {{name}},' || E'\n\n' ||
   'Thanks for submitting a post to the South Sound Theatre Artists callboard. Click the link below to confirm your email and send your post for review.' || E'\n\n' ||
   '{{verify_url}}' || E'\n\n' ||
   'This link expires in 24 hours. If you did not submit a callboard post, you can ignore this email.',
   'Sent when a callboard post is submitted. Variables: {{name}}, {{verify_url}}'),

  ('callboard_approved',
   'Your callboard post is live - South Sound Theatre Artists',
   'Hi {{name}},' || E'\n\n' ||
   'Your callboard post "{{title}}" is now live on the South Sound Theatre Artists callboard.' || E'\n\n' ||
   '{{callboard_url}}' || E'\n\n' ||
   'Your post will remain active until its expiration date. If you need to make changes, reply to this email and we will take care of it.',
   'Sent when admin approves a callboard post. Variables: {{name}}, {{title}}, {{callboard_url}}'),

  ('callboard_rejected',
   'About your callboard submission - South Sound Theatre Artists',
   'Hi {{name}},' || E'\n\n' ||
   'Thanks for submitting to the South Sound Theatre Artists callboard. Unfortunately we were not able to approve your post "{{title}}" at this time.' || E'\n\n' ||
   'Reason: {{reason}}' || E'\n\n' ||
   'If you have questions or would like to resubmit, feel free to reply to this email.',
   'Sent when admin rejects a callboard post. Variables: {{name}}, {{title}}, {{reason}}'),

  ('org_application_received',
   'Verified organization application received - South Sound Theatre Artists',
   'Hi {{name}},' || E'\n\n' ||
   'We received your application for verified status on the South Sound Theatre Artists callboard.' || E'\n\n' ||
   'We review applications by hand, usually within 48 hours. Once verified, your posts will go live immediately without per-post review.' || E'\n\n' ||
   'Questions? Reply to this email.',
   'Sent when an org applies for verified status. Variables: {{name}}'),

  ('org_approved',
   'Your organization is now verified - South Sound Theatre Artists',
   'Hi {{name}},' || E'\n\n' ||
   'Great news - {{org_name}} has been verified on the South Sound Theatre Artists callboard.' || E'\n\n' ||
   'When you post to the callboard using your verified email address, your posts will go live immediately after email confirmation - no per-post review needed.' || E'\n\n' ||
   'Post a call: {{callboard_url}}' || E'\n\n' ||
   'Welcome to the community.',
   'Sent when admin approves an org. Variables: {{name}}, {{org_name}}, {{callboard_url}}')

on conflict (slug) do nothing;
