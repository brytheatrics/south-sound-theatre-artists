-- 059_fix_org_application_audience.sql
-- Fix miscategorisation from 058: org_application_received is sent
-- to the org that just applied (confirmation receipt), not to the
-- admin. Code at /callboard/apply-verified routes it to contactEmail
-- of the applying org. Move it back to community + rewrite the
-- description to match.

update public.email_templates
   set audience = 'community',
       description = 'Sent to an organisation when they submit a verified-status application at /callboard/apply-verified. Confirms we got their application and lets them know to expect a follow-up.'
 where slug = 'org_application_received';
