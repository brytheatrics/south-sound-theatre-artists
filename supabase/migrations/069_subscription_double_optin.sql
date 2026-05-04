-- 069_subscription_double_optin.sql
--
-- Adds double-opt-in to callboard_subscriptions so the subscribe form on
-- /callboard + /calendar can defend against drive-by signups (someone
-- typing other people's emails into the box). Subscribers are inactive
-- until they click the confirmation link emailed to them.
--
-- Existing rows: backfill `confirmed_at = created_at` so the 0 rows
-- already in the table (and any that get added between merge and the
-- cron's next Sunday run) keep behaving as before.
--
-- Also retitles the digest framing - it now covers both callboard and
-- calendar items, so the body copy drops the callboard-specific lead.

alter table public.callboard_subscriptions
  add column if not exists confirmed_at         timestamptz,
  add column if not exists confirmation_token   text;

-- Existing subscriptions are grandfathered in as confirmed.
update public.callboard_subscriptions
   set confirmed_at = created_at
 where confirmed_at is null;

create unique index if not exists callboard_subscriptions_confirm_token_idx
  on public.callboard_subscriptions (confirmation_token)
  where confirmation_token is not null;

-- New email template for the double-opt-in step. Rendered HTML via the
-- shared shell (mig 067).
insert into public.email_templates (slug, subject, body_markdown, audience, description)
values (
  'subscription_confirm',
  'Confirm your South Sound Theatre Artists weekly digest',
  E'Hi there,\n\nYou (or someone using your email) signed up for the weekly digest from South Sound Theatre Artists - a Sunday-evening note rounding up new auditions, designer/crew calls, and upcoming shows in the South Sound theatre community.\n\nClick to confirm:\n\n[{{confirm_url}}]({{confirm_url}})\n\nIf you didn''t sign up, just ignore this and we won''t bother you again.\n\n{{signature}}',
  'community',
  'Sent immediately after someone submits the weekly-digest subscribe form. Single-click confirms the subscription; ignored mail expires harmlessly.'
)
on conflict (slug) do nothing;

-- Refresh the digest body to mention both callboard + calendar. The
-- {{posts}} variable still expands to a markdown list at send time;
-- the new {{productions}} variable carries the calendar slice so the
-- two halves render as separate sections in the email.
update public.email_templates
   set subject = 'Weekly digest from South Sound Theatre Artists',
       body_markdown = E'Hi {{name}},\n\nYour weekly catch-up from the South Sound theatre community.\n\n## New on the callboard\n\n{{posts}}\n\n## Coming up on the calendar\n\n{{productions}}\n\n[Browse the callboard]({{callboard_url}}) - [What''s playing]({{calendar_url}})\n\nUnsubscribe: [{{unsubscribe_url}}]({{unsubscribe_url}})\n\n{{signature}}'
 where slug = 'callboard_weekly_digest';
