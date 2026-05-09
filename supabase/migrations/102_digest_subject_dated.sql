-- 102_digest_subject_dated.sql
--
-- Vary the weekly digest subject by send date so Gmail stops threading
-- consecutive digests into one collapsed conversation. With identical
-- subjects every week, Gmail rolls them up under a single thread and
-- aggressively trims the footer ("Browse the callboard", manage links,
-- signature) as quoted history - subscribers had to click "..." to see
-- the action links. A unique date prefix breaks both behaviours.
--
-- The cron + live preview helper pass {{digest_date}} (formatted as
-- "May 11") so the subject reads "May 11: Weekly digest from South
-- Sound Theatre Artists".

update public.email_templates
   set subject = '{{digest_date}}: Weekly digest from South Sound Theatre Artists'
 where slug = 'callboard_weekly_digest';
