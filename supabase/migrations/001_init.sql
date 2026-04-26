-- 001_init.sql
-- South Sound Theatre Artists - v1 schema
--
-- Creates the v1 tables, enables RLS on every one, and grants public read
-- access only to the tables a browser anon client legitimately needs.
-- See BUILD_PLAN.md "Data Model" for the table inventory.
--
-- Auth note: this app does NOT use Supabase Auth. Identity is handled by
-- single-use magic-link tokens (artists) and a password env var + magic-link
-- 2FA flow (admin). All policies below are written for the `anon` role.
-- Privileged operations run server-side with the service_role key, which
-- bypasses RLS - so no INSERT / UPDATE / DELETE policies are needed.

-- =====================================================================
-- Extensions
-- =====================================================================
create extension if not exists "pgcrypto";  -- gen_random_uuid()
create extension if not exists "citext";    -- case-insensitive emails

-- =====================================================================
-- Helper: auto-update updated_at on row changes
-- =====================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- disciplines
-- Editable list of discipline tags. Seeded in 002_seed.sql.
-- =====================================================================
create table public.disciplines (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index disciplines_sort_order_idx on public.disciplines (sort_order);

create trigger disciplines_set_updated_at
  before update on public.disciplines
  for each row execute function public.set_updated_at();

-- =====================================================================
-- profiles
-- Live, approved artist profiles. A row exists here only after an admin
-- has approved a pending_submission.
-- =====================================================================
create table public.profiles (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  full_name           text not null,
  bio                 text,
  disciplines         text[] not null default '{}',
  headshot_url        text,
  headshot_consent    boolean not null default false,
  availability_status text not null default 'Available',
  experience_level    text,
  union_status        text,
  geographic_area     text,
  age_range           text,
  languages           text[] not null default '{}',
  instagram_handle    text,
  website_url         text,
  email               citext not null,
  member_since        date not null default current_date,
  published           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index profiles_published_idx       on public.profiles (published) where deleted_at is null;
create index profiles_disciplines_idx     on public.profiles using gin (disciplines);
create index profiles_email_idx           on public.profiles (email);
create index profiles_geographic_area_idx on public.profiles (geographic_area);
create index profiles_deleted_at_idx      on public.profiles (deleted_at);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =====================================================================
-- pending_submissions
-- New profiles awaiting email verification + admin approval. Same shape
-- as profiles plus verification + workflow fields. Stays around after
-- approval as an audit record (or you can hard-delete on approval - up
-- to the application).
-- =====================================================================
create table public.pending_submissions (
  id                              uuid primary key default gen_random_uuid(),

  -- Email verification (step before the row enters the admin queue)
  email                           citext not null,
  email_verified                  boolean not null default false,
  email_verification_token_hash   text,
  email_verification_expires_at   timestamptz,

  -- Profile fields
  full_name           text not null,
  bio                 text,
  disciplines         text[] not null default '{}',
  headshot_url        text,
  headshot_consent    boolean not null default false,
  availability_status text not null default 'Available',
  experience_level    text,
  union_status        text,
  geographic_area     text,
  age_range           text,
  languages           text[] not null default '{}',
  instagram_handle    text,
  website_url         text,
  desired_slug        text,

  -- Admin workflow
  status              text not null default 'pending_email'
                        check (status in ('pending_email', 'pending_review', 'approved', 'rejected')),
  rejection_reason    text,
  reviewed_at         timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index pending_submissions_status_idx       on public.pending_submissions (status, created_at);
create index pending_submissions_verify_token_idx on public.pending_submissions (email_verification_token_hash);
create index pending_submissions_email_idx        on public.pending_submissions (email);

create trigger pending_submissions_set_updated_at
  before update on public.pending_submissions
  for each row execute function public.set_updated_at();

-- =====================================================================
-- flagged_edits
-- Major edits (headshot, disciplines) on existing profiles that need
-- re-approval. proposed_changes stores the diff as JSON; the live
-- profile row is not updated until an admin approves.
-- =====================================================================
create table public.flagged_edits (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references public.profiles(id) on delete cascade,
  proposed_changes    jsonb not null,
  status              text not null default 'pending'
                        check (status in ('pending', 'approved', 'rejected')),
  rejection_reason    text,
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index flagged_edits_status_idx     on public.flagged_edits (status, created_at);
create index flagged_edits_profile_id_idx on public.flagged_edits (profile_id);

create trigger flagged_edits_set_updated_at
  before update on public.flagged_edits
  for each row execute function public.set_updated_at();

-- =====================================================================
-- magic_link_tokens
-- Single-use, expiring secrets. Used for both artist edit links (24h)
-- and the admin 6-digit 2FA code (~10 min). The secret is hashed before
-- storage; the plaintext only ever lives in the email body.
-- =====================================================================
create table public.magic_link_tokens (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,
  email       citext not null,
  purpose     text not null check (purpose in ('edit_profile', 'admin_2fa')),
  -- Optional pointer to the row this token authorizes editing of.
  target_id   uuid,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index magic_link_tokens_email_purpose_idx on public.magic_link_tokens (email, purpose);
create index magic_link_tokens_expires_at_idx    on public.magic_link_tokens (expires_at);

-- =====================================================================
-- email_log
-- Every Resend send is logged here before the API call. Recipient is
-- hashed (sha256 hex) so the log itself doesn't expose addresses. Pruned
-- to 35 days by a daily cron.
-- =====================================================================
create table public.email_log (
  id              uuid primary key default gen_random_uuid(),
  recipient_hash  text not null,
  email_type      text not null,
  subject         text,
  resend_id       text,
  status          text not null default 'sent' check (status in ('sent', 'failed')),
  error           text,
  sent_at         timestamptz not null default now()
);
create index email_log_sent_at_idx        on public.email_log (sent_at);
create index email_log_recipient_hash_idx on public.email_log (recipient_hash, sent_at);
create index email_log_email_type_idx     on public.email_log (email_type, sent_at);

-- =====================================================================
-- email_blocklist
-- Admin-curated list of sender addresses to silently drop (the contact
-- form returns success, but no email is delivered).
-- =====================================================================
create table public.email_blocklist (
  id          uuid primary key default gen_random_uuid(),
  email       citext not null unique,
  note        text,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- reports
-- User-submitted reports on profiles or callboard posts. Polymorphic
-- via (target_type, target_id); no FK so a report survives a target
-- being soft-deleted.
-- =====================================================================
create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  target_type     text not null check (target_type in ('profile', 'callboard_post')),
  target_id       uuid not null,
  reporter_email  citext,
  reason          text not null,
  status          text not null default 'open'
                    check (status in ('open', 'resolved', 'dismissed')),
  admin_notes     text,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at);
create index reports_target_idx on public.reports (target_type, target_id);

create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- =====================================================================
-- featured_profiles
-- Admin-curated homepage spotlight rotation. The site picks a daily
-- slice of these via a date-bucketed seed.
-- =====================================================================
create table public.featured_profiles (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null unique references public.profiles(id) on delete cascade,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index featured_profiles_active_idx on public.featured_profiles (active, sort_order);

-- =====================================================================
-- site_content
-- Editable copy keyed by slug (home, about, support_us, contact, footer).
-- All public-page copy is loaded from here so Lexi can edit without code.
-- =====================================================================
create table public.site_content (
  slug          text primary key,
  title         text,
  body_markdown text not null default '',
  updated_at    timestamptz not null default now()
);

create trigger site_content_set_updated_at
  before update on public.site_content
  for each row execute function public.set_updated_at();

-- =====================================================================
-- email_templates
-- Editable email body templates with {{variable}} placeholders. Keyed
-- by slug. The sendEmail wrapper renders these.
-- =====================================================================
create table public.email_templates (
  slug          text primary key,
  subject       text not null,
  body_markdown text not null default '',
  description   text,           -- notes for admin: which variables are available
  updated_at    timestamptz not null default now()
);

create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

-- =====================================================================
-- announcement_banner
-- Optional site-wide banner with date range. Multiple rows allowed so
-- admin can stage future banners; the public read policy filters to
-- the currently-active one.
-- =====================================================================
create table public.announcement_banner (
  id            uuid primary key default gen_random_uuid(),
  body_markdown text not null,
  enabled       boolean not null default false,
  starts_at     timestamptz,
  ends_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index announcement_banner_window_idx
  on public.announcement_banner (enabled, starts_at, ends_at);

create trigger announcement_banner_set_updated_at
  before update on public.announcement_banner
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Row Level Security
-- =====================================================================
-- Enable RLS on every table. Tables without an explicit policy below are
-- locked down to the anon and authenticated roles entirely - the server
-- reaches them via service_role, which bypasses RLS.

alter table public.disciplines           enable row level security;
alter table public.profiles              enable row level security;
alter table public.pending_submissions   enable row level security;
alter table public.flagged_edits         enable row level security;
alter table public.magic_link_tokens     enable row level security;
alter table public.email_log             enable row level security;
alter table public.email_blocklist       enable row level security;
alter table public.reports               enable row level security;
alter table public.featured_profiles     enable row level security;
alter table public.site_content          enable row level security;
alter table public.email_templates       enable row level security;
alter table public.announcement_banner   enable row level security;

-- Public read policies -------------------------------------------------

-- Anyone can list disciplines (needed by the public submission form filter).
create policy "Public can read disciplines"
  on public.disciplines for select
  to anon, authenticated
  using (true);

-- Anyone can view published, non-deleted profiles.
create policy "Public can read published profiles"
  on public.profiles for select
  to anon, authenticated
  using (published = true and deleted_at is null);

-- Anyone can read site copy.
create policy "Public can read site_content"
  on public.site_content for select
  to anon, authenticated
  using (true);

-- Anyone can see active featured-profile rotation entries. The browser
-- still needs to hit profiles to render details, where the published
-- filter applies.
create policy "Public can read active featured profiles"
  on public.featured_profiles for select
  to anon, authenticated
  using (active = true);

-- Anyone can see an enabled banner inside its date window. starts_at /
-- ends_at null means "no lower / upper bound".
create policy "Public can read active announcement banner"
  on public.announcement_banner for select
  to anon, authenticated
  using (
    enabled = true
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >  now())
  );

-- Tables intentionally left with NO anon policies (server-only access):
--   pending_submissions, flagged_edits, magic_link_tokens,
--   email_log, email_blocklist, reports, email_templates
