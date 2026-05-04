-- 068_append_signature_to_templates.sql
-- Append {{signature}} to every audience='community' email template
-- body so the new HTML email pipeline (mig 067) renders the standard
-- sign-off in every external-facing message.
--
-- audience='admin' templates (admin_2fa, admin_daily_digest,
-- admin_volume_alert, daily_digest) are skipped on purpose - those go
-- to Lexi/Blake and don't need a signature on every send.
--
-- Idempotent guard: only appends when the template doesn't already
-- include a {{signature}} placeholder (in case admin manually added one
-- before this migration runs in another environment).

update public.email_templates
   set body_markdown = trim(both E'\n' from body_markdown) || E'\n\n{{signature}}'
 where audience = 'community'
   and body_markdown not like '%{{signature}}%';
