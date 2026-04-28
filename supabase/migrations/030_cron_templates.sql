-- 030_cron_templates.sql
-- Email templates for the new cron jobs (daily admin digest, email
-- volume alert, stale-profile ping, weekly callboard digest). All
-- editable from /admin/templates after this migration runs - the
-- markdown is the default copy, not a hard-coded string.

insert into public.email_templates (slug, subject, body_markdown) values
  ('admin_daily_digest',
   'SSTA admin: {{total}} item{{plural}} need attention',
   $body$Hi Lexi,

There {{verb}} **{{total}} item{{plural}}** waiting in the admin queues this morning:

{{breakdown}}

Open the admin panel to clear them: {{admin_url}}

(This email only goes out when something is actually queued, so you can trust an empty inbox.)
$body$),

  ('admin_volume_alert',
   'SSTA Resend usage at {{percent}}% ({{sent}}/{{cap}})',
   $body$Heads up,

The site sent **{{sent}} emails** so far this calendar month against the Resend free-tier cap of {{cap}}. That's **{{percent}}%**.

If usage stays on this trajectory, the cap will be hit before the month ends. Worth a glance at the email_log to see if a particular template is dominating.

This alert fires once at 70% and again at 90%.
$body$),

  ('stale_profile_ping',
   'Still active in the South Sound theatre community?',
   $body$Hi {{name}},

It's been about 18 months since your South Sound Theatre Artists profile was last updated. We're checking in - are you still active in the community?

**To keep your profile listed**, just reply to this email or update anything on your profile via:

{{edit_url}}

If we don't hear back in 30 days, we'll archive the profile. You can always come back and resubmit later.

Thanks for being part of the directory!
- South Sound Theatre Artists
$body$),

  ('callboard_weekly_digest',
   'New on the SSTA callboard this week',
   $body$Hi {{name}},

Here's what's new on the callboard matching your interests:

{{posts}}

See everything: {{callboard_url}}

You're receiving this because you opted in to weekly callboard updates. Manage your preferences via your profile edit link, or reply to unsubscribe.
$body$)
on conflict (slug) do nothing;
