-- 060_org_approved_calendar_too.sql
-- Reflects that verified-org auto-publish applies to /calendar/submit
-- as well as /callboard/submit. The old body only mentioned callboard,
-- which read like calendar submissions still went to admin review when
-- in fact they auto-publish too (same verified_org_id lookup on both
-- verify endpoints).
--
-- New body adds calendar context + a {{calendar_url}} variable. The
-- send-site at /admin/orgs gets a parallel update to fill that var.

update public.email_templates
   set body_markdown = 'Hi {{name}},' || E'\n\n' ||
                       'Great news — {{org_name}} has been verified on South Sound Theatre Artists.' || E'\n\n' ||
                       'When you post to the callboard or submit a performance to the calendar using your verified email address, your post will go live immediately after email confirmation — no per-post review needed.' || E'\n\n' ||
                       'Post a call: {{callboard_url}}' || E'\n\n' ||
                       'Add a performance: {{calendar_url}}' || E'\n\n' ||
                       'Welcome to the community.'
 where slug = 'org_approved';
