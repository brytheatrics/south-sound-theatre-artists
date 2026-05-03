-- 040_event_categories.sql
-- v2.x calendar: admin-managed list of categories for productions /
-- staged readings / fundraisers / workshops / etc. Mirrors the
-- resource_categories pattern. `default_visible` controls whether the
-- public calendar UI shows entries in this category by default; users
-- toggle the others on. Per the v2.x product decision, "production"
-- and "reading" default on; everything else defaults off.

create table if not exists public.event_categories (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  slug            text not null unique,
  description     text,
  default_visible boolean not null default false,
  sort_order      integer not null default 100,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists event_categories_sort_idx
  on public.event_categories (sort_order, name);

create trigger event_categories_set_updated_at
  before update on public.event_categories
  for each row execute function public.set_updated_at();

-- Seed the starter categories. Admin can rename / reorder / delete from
-- /admin/event-categories. Idempotent on re-run via slug uniqueness.
insert into public.event_categories (name, slug, description, default_visible, sort_order) values
  ('Production',    'production',    'Mainstage plays and musicals.',                              true,  10),
  ('Staged reading','reading',       'Script-in-hand readings and workshop presentations.',        true,  20),
  ('Special event', 'special-event', 'Themed performances (murder mystery dinner, cabaret, etc).', true,  30),
  ('Workshop',      'workshop',      'Audience-facing classes or open rehearsals.',                false, 40),
  ('Fundraiser',    'fundraiser',    'Galas, benefits, and other fundraising events.',             false, 50)
on conflict (slug) do nothing;

alter table public.event_categories enable row level security;

create policy "Public can read event categories"
  on public.event_categories for select
  to anon, authenticated
  using (true);
