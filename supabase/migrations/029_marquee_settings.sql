-- 029_marquee_settings.sql
-- The 028 migration tied callboard inclusion to announcement_banner, but
-- conceptually the announcement banner is a single admin-typed message
-- and the homepage marquee is the right place for callboard rotation.
-- This migration:
--   1. Drops the announcement_banner.{include_all_callboard,
--      include_callboard_post_ids} columns added in 028.
--   2. Creates marquee_settings: a single-row table that controls the
--      homepage marquee at the bottom of the hero. It can include all
--      open callboard posts or an admin-picked subset.

alter table public.announcement_banner
  drop column if exists include_all_callboard,
  drop column if exists include_callboard_post_ids;

create table if not exists public.marquee_settings (
  -- single-row enforcement: the check guarantees only id = 1 exists.
  id                          smallint primary key default 1 check (id = 1),
  enabled                     boolean not null default true,
  include_all_callboard       boolean not null default true,
  include_callboard_post_ids  uuid[]  not null default '{}',
  updated_at                  timestamptz not null default now()
);

insert into public.marquee_settings (id) values (1) on conflict (id) do nothing;

create trigger marquee_settings_set_updated_at
  before update on public.marquee_settings
  for each row execute function public.set_updated_at();

-- Public-readable so the homepage SSR can include it. RLS already enabled
-- by-default elsewhere; this table just gets a permissive read policy.
alter table public.marquee_settings enable row level security;

create policy "Public can read marquee settings"
  on public.marquee_settings for select
  to anon, authenticated
  using (enabled = true);
