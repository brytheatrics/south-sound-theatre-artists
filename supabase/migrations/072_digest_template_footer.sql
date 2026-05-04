-- 072_digest_template_footer.sql
--
-- Replaces the callboard_weekly_digest body with the new footer
-- pattern (mig 071 territory): always-shown manage + unsubscribe
-- links, plus a conditional "new options have been added" notice
-- assembled per-subscriber by the cron.
--
-- The cron passes {{new_options_notice}} as either an empty string
-- (nothing new for this subscriber) or a two-line markdown block
-- including a manage link of its own. The always-shown footer below
-- it carries the second manage link + unsubscribe.

update public.email_templates
   set subject = 'Weekly digest from South Sound Theatre Artists',
       body_markdown =
         E'Hi {{name}},' || E'\n\n' ||
         E'Your weekly catch-up from the South Sound theatre community.' || E'\n\n' ||
         E'## New on the callboard' || E'\n\n' ||
         E'{{posts}}' || E'\n\n' ||
         E'## Coming up on the calendar' || E'\n\n' ||
         E'{{productions}}' || E'\n\n' ||
         E'[Browse the callboard]({{callboard_url}}) - [What''s playing]({{calendar_url}})' || E'\n\n' ||
         E'---' || E'\n\n' ||
         E'{{new_options_notice}}' || E'\n\n' ||
         E'[Manage your digest]({{manage_url}}) · [Unsubscribe]({{unsubscribe_url}})' || E'\n\n' ||
         E'{{signature}}'
 where slug = 'callboard_weekly_digest';
