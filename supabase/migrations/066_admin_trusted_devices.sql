-- 066_admin_trusted_devices.sql
--
-- "Remember this device for 30 days" - on a successful 2FA the admin can
-- opt into skipping 2FA on subsequent logins from the same browser.
-- Password is still required every time. Only the 2FA step gets bypassed.
--
-- Stored in its own table rather than a flag on admin_sessions so:
--   - Trusted-device cookies survive across session expiry / signout.
--   - Revoking a trusted device doesn't kill an active session.
--   - Two cookies (session + trusted device) can coexist independently.

create table public.admin_trusted_devices (
  id              uuid primary key default gen_random_uuid(),
  token_hash      text not null unique,
  email           citext not null,
  label           text,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null,
  last_used_at    timestamptz,
  ip_address      text,
  user_agent      text
);

create index admin_trusted_devices_email_idx
  on public.admin_trusted_devices (email);
create index admin_trusted_devices_expires_idx
  on public.admin_trusted_devices (expires_at);

alter table public.admin_trusted_devices enable row level security;
-- No public policies; service-role inserts/selects only.

comment on table public.admin_trusted_devices is
  'Long-lived "remember this device" cookies. Issued on successful 2FA when admin opts in; consumed at /admin/login to skip the 2FA step.';
