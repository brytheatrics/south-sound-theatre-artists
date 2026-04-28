-- 025_callboard.sql
-- v1.2: verified_orgs, callboard_posts, productions tables.
-- Email verification for callboard posts follows the same pattern as
-- pending_submissions: token hash stored on the row itself.

-- =====================================================================
-- verified_orgs
-- Theatre organizations vetted by the admin. Verified orgs' callboard
-- posts go live immediately after email verify with no per-post review.
-- =====================================================================
create table public.verified_orgs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_email citext not null,
  website_url   text,
  description   text,
  verified      boolean not null default false,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index verified_orgs_verified_idx   on public.verified_orgs (verified) where deleted_at is null;
create index verified_orgs_email_idx      on public.verified_orgs (contact_email);
create index verified_orgs_deleted_at_idx on public.verified_orgs (deleted_at);

create trigger verified_orgs_set_updated_at
  before update on public.verified_orgs
  for each row execute function public.set_updated_at();

-- =====================================================================
-- callboard_posts
-- All post types in one table. Nullable columns apply to specific
-- post types (e.g. ticket_url only makes sense for 'production').
-- key_dates is a jsonb array of [label, value] pairs for the "Key
-- dates" strip on each card. deadline_text is freeform display;
-- expires_at is the machine-readable cutoff for auto-unpublish.
-- =====================================================================
create table public.callboard_posts (
  id                uuid primary key default gen_random_uuid(),

  -- Core (all post types)
  post_type         text not null
                      check (post_type in ('audition', 'designer', 'crew', 'production', 'general')),
  title             text not null,
  organization_name text not null,
  location          text,
  description       text,

  -- Audition / general: named roles. Designer / crew: positions wanted.
  roles             text[] not null default '{}',

  -- compensation_type for filtering; compensation for display detail.
  compensation_type text
                      check (compensation_type in ('paid', 'stipend', 'volunteer', 'none')),
  compensation      text,

  contact_info      text,

  -- Flexible date strip rendered on the card. Format: [[label, value], ...]
  key_dates         jsonb not null default '[]',

  -- Freeform display: "Sign up by May 5", "Open until filled", etc.
  deadline_text     text,

  -- Auto-unpublish when this timestamp passes.
  expires_at        timestamptz,

  -- Production announcements only.
  ticket_url        text,

  -- Submitter (never shown publicly)
  submitter_email   citext not null,

  -- Null = unverified individual. Set when org's email matches a verified org.
  verified_org_id   uuid references public.verified_orgs(id) on delete set null,

  -- Email verification: same pattern as pending_submissions.
  email_verification_token_hash text,
  email_verification_expires_at timestamptz,

  -- Workflow
  status            text not null default 'pending_email'
                      check (status in ('pending_email', 'pending_review', 'approved', 'rejected')),
  rejection_reason  text,
  reviewed_at       timestamptz,
  published         boolean not null default false,
  deleted_at        timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index callboard_posts_status_idx    on public.callboard_posts (status, created_at);
create index callboard_posts_published_idx on public.callboard_posts (published, post_type) where deleted_at is null;
create index callboard_posts_expires_idx   on public.callboard_posts (expires_at) where published = true;
create index callboard_posts_org_idx       on public.callboard_posts (verified_org_id);
create index callboard_posts_email_idx     on public.callboard_posts (submitter_email);
create index callboard_posts_deleted_idx   on public.callboard_posts (deleted_at);
create index callboard_posts_token_idx     on public.callboard_posts (email_verification_token_hash);

create trigger callboard_posts_set_updated_at
  before update on public.callboard_posts
  for each row execute function public.set_updated_at();

-- =====================================================================
-- productions
-- Populated as a side-effect of approving audition / production posts.
-- Provides the data layer for the v1.3 discovery features ("What's
-- Playing" calendar, "Currently appearing in" profile badges).
-- =====================================================================
create table public.productions (
  id                uuid primary key default gen_random_uuid(),
  callboard_post_id uuid references public.callboard_posts(id) on delete set null,
  title             text not null,
  organization_name text not null,
  location          text,
  show_dates        text,
  ticket_url        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index productions_post_id_idx on public.productions (callboard_post_id);

create trigger productions_set_updated_at
  before update on public.productions
  for each row execute function public.set_updated_at();
