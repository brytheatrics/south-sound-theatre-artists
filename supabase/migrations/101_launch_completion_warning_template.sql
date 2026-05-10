-- 101_launch_completion_warning_template.sql
--
-- Seeds the launch_completion_warning email template. Sent by the
-- stale-cleanup cron 3 days before a launch-invited profile is auto-
-- hidden for missing required fields. Friendly heads-up so the artist
-- has a chance to fill things in before they drop from the directory.

insert into public.email_templates (slug, audience, subject, body_markdown)
values (
  'launch_completion_warning',
  'community',
  'Your South Sound Theatre Artists profile needs a few more details',
  $body$Hi {{name}},

Quick heads-up: your profile on the South Sound Theatre Artists directory is missing some details that public submissions require, and we'll be hiding incomplete profiles starting {{hide_date}}. You'll stay hidden from the public directory until you fill them in.

What's still missing:

{{missing_fields}}

To stay listed, click below and fill those in. Saves go live the moment they're complete - no admin review needed.

[Update my profile]({{edit_url}})

If you'd rather not be in the directory, you can also use the link above to delete the profile entirely.

{{signature}}$body$
)
on conflict (slug) do update
   set subject = excluded.subject,
       body_markdown = excluded.body_markdown,
       audience = excluded.audience;
