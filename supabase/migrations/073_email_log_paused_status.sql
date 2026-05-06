-- 073_email_log_paused_status.sql
-- Add 'paused' as a valid status on email_log so the email pipeline's
-- audience-based pause (EMAIL_PAUSE_COMMUNITY env var) can record what
-- it short-circuited without using a misleading 'failed' marker.
--
-- 'paused' rows go in for community-bound templates when the env flag
-- is on. Admin can audit "what would have gone out" via the email_log
-- table during the pre-launch period.

alter table public.email_log
  drop constraint if exists email_log_status_check;
alter table public.email_log
  add constraint email_log_status_check
  check (status in ('sent', 'failed', 'paused'));
