-- 039_admin_invitation_copy_refresh.sql
-- The original admin_invitation copy (mig 035) hard-asserted "It's
-- live now at: {{profile_url}}". That's only true when every required
-- field was present at admin-create time. With the complete-to-publish
-- gate, profiles missing required info ship unpublished and need the
-- artist to fill them in before they go live - so the email shouldn't
-- promise it's already live.
--
-- New copy is neutral: "we set up a profile based on what you sent in"
-- + a heads-up that the editor will tell them what (if anything)
-- still needs filling in. Reads accurately for both already-complete
-- profiles (the editor will say nothing's missing) and gated ones
-- (the banner lists exactly what to fill in, save auto-publishes).
--
-- Lexi can keep editing the copy from /admin/templates after this.

update public.email_templates
set
  body_markdown = $body$Hi {{name}},

We set up a profile for you on the South Sound Theatre Artists directory based on the bio and headshot you sent in. To finish it off (or fix anything we got wrong), use this single-use link to open your profile editor:

{{edit_url}}

If your profile is missing required info (like your geographic area), the editor will tell you exactly what to fill in. Once you save with everything in place, your page goes live at:

{{profile_url}}

You can update your bio, headshot, disciplines, contact info, social links, resume, or anything else. The link expires in 24 hours - if you don't get to it in time, request a fresh one any time at:

{{site_url}}/edit-link

Welcome to the directory.
- South Sound Theatre Artists
$body$
where slug = 'admin_invitation';
