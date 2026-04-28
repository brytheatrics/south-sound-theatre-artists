-- 034_resources.sql
-- Curated resource library: links to organisations, classes, funding,
-- production resources, etc. Admin-managed entirely from /admin/resources.
-- Public read at /resources with category grouping.

create table if not exists public.resource_categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  description   text,
  sort_order    integer not null default 100,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger resource_categories_set_updated_at
  before update on public.resource_categories
  for each row execute function public.set_updated_at();

create table if not exists public.resources (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  url           text not null,
  description   text,
  category_id   uuid references public.resource_categories(id) on delete set null,
  sort_order    integer not null default 100,
  published     boolean not null default true,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index resources_published_idx on public.resources (published) where deleted_at is null;
create index resources_category_idx  on public.resources (category_id);
create index resources_deleted_idx   on public.resources (deleted_at);

create trigger resources_set_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();

-- Seed a starter set of categories. Admin can rename / reorder /
-- delete from /admin/resources. Idempotent on re-run.
insert into public.resource_categories (name, description, sort_order) values
  ('For artists',     'Classes, workshops, training programs, professional development.', 10),
  ('For producers',   'Tools, templates, and resources for producing companies.',          20),
  ('Funding & grants','Arts grants, fiscal sponsors, fundraising tools.',                 30),
  ('Community',       'Service organizations, advocacy groups, listservs.',               40),
  ('Other',           'Anything that doesn''t fit the above.',                            50)
on conflict (name) do nothing;

alter table public.resource_categories enable row level security;
alter table public.resources           enable row level security;

create policy "Public can read resource categories"
  on public.resource_categories for select
  to anon, authenticated
  using (true);

create policy "Public can read published resources"
  on public.resources for select
  to anon, authenticated
  using (published = true and deleted_at is null);
