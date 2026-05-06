-- 077_submit_rate_limits.sql
-- Per-IP per-endpoint rate-limit log for the public submit + contact
-- form endpoints. Honeypot + email-verification gives some friction
-- but a determined script could flood pending_submissions / pending
-- email-verifies / sender contact-form messages and force mass cleanup.
-- Even simple per-IP cooldowns close the worst abuse vector.
--
-- Mirrors the `admin_login_attempts` pattern exactly so the helper
-- shape feels familiar. One row per attempt; checkSubmitRateLimit()
-- counts rows in the past hour for that (ip, endpoint) tuple and
-- denies when the threshold is hit.

create table if not exists public.submit_rate_limits (
  id uuid primary key default gen_random_uuid(),
  ip_address text not null,
  endpoint text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists submit_rate_limits_lookup_idx
  on public.submit_rate_limits (ip_address, endpoint, attempted_at desc);

-- Periodic cleanup: nothing actively prunes this table. Rows older than
-- 24 hours are useless for the rate-limit window and just waste space.
-- The stale-profile-cleanup cron is the natural home for a DELETE
-- statement against this table; for now the table is tiny enough that
-- it doesn't matter.
