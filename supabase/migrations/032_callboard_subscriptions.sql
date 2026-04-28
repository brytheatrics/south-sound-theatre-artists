-- 032_callboard_subscriptions.sql
-- Opt-in weekly digest for callboard posts.
--
-- subscriber_email is the unique key. Each subscription holds an array
-- of disciplines the artist wants to be notified about (empty array =
-- all disciplines / "anything new"). post_types is a similar filter -
-- defaults to all five types.
--
-- The unsubscribe flow stamps unsubscribed_at and stops sends without
-- losing the row, so a re-subscribe doesn't lose history.

create table if not exists public.callboard_subscriptions (
  id                uuid primary key default gen_random_uuid(),
  subscriber_email  citext not null unique,
  disciplines       text[] not null default '{}',
  post_types        text[] not null default '{audition,designer,crew,production,general}',
  -- Set when the cron sent the most recent digest, so weekly runs can
  -- "since X" correctly even if a run gets skipped or runs early.
  last_digest_at    timestamptz,
  unsubscribed_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index callboard_subscriptions_active_idx
  on public.callboard_subscriptions (unsubscribed_at)
  where unsubscribed_at is null;

create trigger callboard_subscriptions_set_updated_at
  before update on public.callboard_subscriptions
  for each row execute function public.set_updated_at();

alter table public.callboard_subscriptions enable row level security;
-- No public policies - server-only via service role.
