-- 080_admin_users.sql
--
-- Multi-admin: today /admin is gated by a single ADMIN_PASSWORD env var
-- and 2FA codes go to a single ADMIN_EMAIL. v1.1 adds per-user accounts
-- so Lexi can invite a co-admin from /admin/admins without a code change.
--
-- Bootstrap path: this migration creates the table empty. The first
-- admin login after the migration runs the env-var auth as before AND
-- writes a row into admin_users for ADMIN_EMAIL with the bcrypted
-- ADMIN_PASSWORD value. From that point on, the table is authoritative;
-- the env vars stay as a "lost master password" fallback.
--
-- Roles: 'owner' (the bootstrapped account, can invite + remove other
-- admins) vs 'admin' (everything else, can do all admin work but can't
-- promote/demote other admins). For v1.1 the gating between the two is
-- minimal (only /admin/admins is owner-restricted); ARCHITECTURE-side
-- granularity is future work.
--
-- Sessions and trusted devices both gain an admin_user_id FK so each
-- session is attributed to a specific person. Existing sessions and
-- devices are wiped because they predate per-user identity - everyone
-- re-logs on next visit. Pre-launch, this is fine; Lexi is the only
-- person with a session today.

create table public.admin_users (
  id              uuid primary key default gen_random_uuid(),
  email           citext not null unique,
  password_hash   text,                              -- null until invitee sets their own
  name            text,
  role            text not null default 'admin',    -- 'owner' | 'admin'
  invited_by      uuid references public.admin_users(id) on delete set null,
  invited_at      timestamptz not null default now(),
  password_set_at timestamptz,                      -- null until invitee accepts invite + sets password
  last_login_at   timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint admin_users_role_check check (role in ('owner', 'admin'))
);

create unique index admin_users_email_uniq
  on public.admin_users (email) where deleted_at is null;
create index admin_users_role_idx
  on public.admin_users (role) where deleted_at is null;

create trigger admin_users_set_updated_at
  before update on public.admin_users
  for each row execute function public.set_updated_at();

alter table public.admin_users enable row level security;

-- Per-session attribution. Existing rows wiped below.
alter table public.admin_sessions
  add column admin_user_id uuid references public.admin_users(id) on delete cascade;

create index admin_sessions_user_idx
  on public.admin_sessions (admin_user_id);

alter table public.admin_trusted_devices
  add column admin_user_id uuid references public.admin_users(id) on delete cascade;

create index admin_trusted_devices_user_idx
  on public.admin_trusted_devices (admin_user_id);

-- Wipe pre-multi-admin auth state. Owner re-logs on next visit and gets
-- a row in admin_users via the bootstrap-on-first-login flow. This is
-- safe pre-launch (Lexi is the only person with a session today).
delete from public.admin_sessions;
delete from public.admin_trusted_devices;

-- magic_link_tokens already supports arbitrary 'purpose' values; the
-- admin invite flow uses purpose='admin_invite' with target_id = the
-- admin_users.id. No schema change needed there.
