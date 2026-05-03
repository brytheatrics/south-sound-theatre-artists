-- 058_email_templates_audience.sql
-- Splits the email templates into two audiences so /admin/templates
-- can show admin-bound templates (low polish OK - Lexi reading her own
-- inbox) separately from community-bound templates (need careful copy
-- since real artists / orgs see them).
--
-- Also rewrites the description column for every row in plain Lexi-
-- voice. Old descriptions were either null or a developer-style
-- "Variables: {{a}}, {{b}}" listing - useful at debug time but not
-- for understanding when an email actually fires.

alter table public.email_templates
  add column if not exists audience text not null default 'community';

alter table public.email_templates
  drop constraint if exists email_templates_audience_check;
alter table public.email_templates
  add constraint email_templates_audience_check
    check (audience in ('admin', 'community'));

-- Set audience + plain-English description per template. Where the old
-- description listed variable names, those go into the public-facing
-- copy via {{handlebars}} - Lexi doesn't need to track them, the
-- send pipeline does.

update public.email_templates set audience = 'admin', description =
  'Sent to you when you sign in to /admin. The 6-digit code expires after 10 minutes.'
where slug = 'admin_2fa';

update public.email_templates set audience = 'admin', description =
  'Sent to you when something needs your attention (pending submissions, flagged edits, open reports). Skipped on quiet days.'
where slug = 'admin_daily_digest';

update public.email_templates set audience = 'admin', description =
  'Sent to you when monthly Resend email volume crosses 70% and again at 90%, so we can throttle before hitting the free-tier cap.'
where slug = 'admin_volume_alert';

update public.email_templates set audience = 'admin', description =
  'Same as the daily digest but the older copy. Kept for now; consolidating into one is a future cleanup.'
where slug = 'daily_digest';

update public.email_templates set audience = 'admin', description =
  'Sent to you when an org submits a verified-organization application via /callboard/orgs/apply. Tells you to review at /admin/orgs.'
where slug = 'org_application_received';

-- ===== Community-bound (Lexi should care about copy) =====

update public.email_templates set audience = 'community', description =
  'Sent to artists you imported by hand before launch (the bulk import). Has their magic link to claim and edit their profile.'
where slug = 'admin_invitation';

update public.email_templates set audience = 'community', description =
  'Sent when you approve a calendar submission. The submitter gets confirmation and a link to their show on /calendar.'
where slug = 'calendar_approved';

update public.email_templates set audience = 'community', description =
  'Sent when you reject a calendar submission. The submitter gets your reason if you provided one.'
where slug = 'calendar_rejected';

update public.email_templates set audience = 'community', description =
  'First email someone gets after submitting a show via /calendar/submit. They click the verify link before it goes to your review queue.'
where slug = 'calendar_verify';

update public.email_templates set audience = 'community', description =
  'Sent when you approve a callboard post. The submitter gets confirmation and a link to their post.'
where slug = 'callboard_approved';

update public.email_templates set audience = 'community', description =
  'Sent when you reject a callboard post. The submitter gets your reason if you provided one.'
where slug = 'callboard_rejected';

update public.email_templates set audience = 'community', description =
  'First email someone gets after submitting to the callboard. They click the verify link before it goes to your review queue (or auto-publishes if their org is verified).'
where slug = 'callboard_verify';

update public.email_templates set audience = 'community', description =
  'Sent every Sunday night to artists who opted in to weekly digests. Lists callboard posts that opened in the past week.'
where slug = 'callboard_weekly_digest';

update public.email_templates set audience = 'community', description =
  'Wrapper email when one community member uses the contact form on someone else''s profile. The actual artist''s email is never exposed.'
where slug = 'contact_routed';

update public.email_templates set audience = 'community', description =
  'First email a new artist gets after submitting to /submit. They click the verify link before their submission goes to your review queue.'
where slug = 'email_verification';

update public.email_templates set audience = 'community', description =
  'The edit link an artist receives when they request one from /edit-link. Single-use, expires in 24 hours.'
where slug = 'magic_link';

update public.email_templates set audience = 'community', description =
  'A fresh edit link, sent when an artist needs a new one (the old expired or got lost). Same flow as magic_link with slightly different framing.'
where slug = 'magic_link_resend';

update public.email_templates set audience = 'community', description =
  'Sent to a verified organization when you approve their application. Confirms they can post directly to the callboard now.'
where slug = 'org_approved';

update public.email_templates set audience = 'community', description =
  'Sent when you reject an artist''s profile submission. The submitter gets your reason if you provided one.'
where slug = 'rejection';

update public.email_templates set audience = 'community', description =
  'Sent to artists whose profile hasn''t been touched in 18 months. Asks "are you still active?" with a fresh edit link. If they don''t respond in 30 days the profile gets auto-archived.'
where slug = 'stale_profile_ping';

update public.email_templates set audience = 'community', description =
  'Sent to a new artist when you approve their submission. Has a link to their live profile and a magic link to edit it later.'
where slug = 'welcome';

comment on column public.email_templates.audience is
  'Who receives this email. ''admin'' = goes to Lexi only (low polish OK); ''community'' = goes to artists / orgs / audience members (copy matters).';
