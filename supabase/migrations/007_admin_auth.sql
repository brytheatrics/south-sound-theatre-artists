-- 007_admin_auth.sql
-- Tables for admin authentication: revocable session tokens and a
-- per-IP attempt log so we can lock out brute-force password guessing.
--
-- The admin password itself lives in the ADMIN_PASSWORD env var and is
-- compared in constant time on the server. Magic-link 2FA codes reuse
-- the existing magic_link_tokens table with purpose='admin_2fa'.

create table public.admin_sessions (
  id            uuid primary key default gen_random_uuid(),
  token_hash    text not null unique,
  email         citext not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  last_used_at  timestamptz not null default now(),
  ip_address    text,
  user_agent    text
);
create index admin_sessions_expires_idx on public.admin_sessions (expires_at);

alter table public.admin_sessions enable row level security;
-- No anon policies. Server-only via service_role.

create table public.admin_login_attempts (
  id            uuid primary key default gen_random_uuid(),
  ip_address    text not null,
  attempted_at  timestamptz not null default now(),
  success       boolean not null,
  reason        text
);
create index admin_login_attempts_ip_time_idx
  on public.admin_login_attempts (ip_address, attempted_at desc);

alter table public.admin_login_attempts enable row level security;
-- No anon policies. Server-only via service_role.
