-- 035_admin_invitation_template.sql
-- Email template for "admin set up your profile, claim it" invitations.
-- Different from `magic_link` (artist initiated, "here's your link
-- back") and `welcome` (artist submitted, was approved). This is for
-- admin-created profiles - the bulk-import batch and any one-off
-- profiles Lexi creates from /admin/profiles/new.
--
-- Lexi can fine-tune the copy from /admin/templates after this lands.

insert into public.email_templates (slug, subject, body_markdown) values
  ('admin_invitation',
   'Your South Sound Theatre Artists profile is ready - claim it',
   $body$Hi {{name}},

We set up a profile for you on the South Sound Theatre Artists directory based on the bio and headshot you sent in. It's live now at:

{{profile_url}}

To finish it off (or fix anything we got wrong), use this single-use link to open your profile editor:

{{edit_url}}

You can update your bio, headshot, disciplines, contact info, social links, resume, or anything else. The link expires in 24 hours - if you don't get to it in time, request a fresh one any time at:

{{site_url}}/edit-link

Welcome to the directory.
- South Sound Theatre Artists
$body$)
on conflict (slug) do nothing;
