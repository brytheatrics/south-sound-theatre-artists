-- 081_blog_posts.sql
--
-- Blog: a place for posts written by Lexi (or future co-admins) in
-- their own voice. Distinct from /resources (curated outside links)
-- and from /about (single static page). Same markdown editor + toolbar
-- shape as /admin/content.
--
-- Author display defaults to 'Lexi Barnett' for v1.1; the FK to
-- admin_users (added in 080) lets future-us swap that for the actual
-- author's name once multi-admin is in regular use.

create table public.blog_posts (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null,
  title                text not null,
  body_markdown        text not null default '',
  cover_url            text,                       -- optional Cloudinary URL
  author_admin_user_id uuid references public.admin_users(id) on delete set null,
  author_display_name  text not null default 'Lexi Barnett',
  published            boolean not null default false,
  published_at         timestamptz,
  deleted_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index blog_posts_slug_uniq
  on public.blog_posts (slug) where deleted_at is null;
create index blog_posts_published_idx
  on public.blog_posts (published_at desc)
  where published = true and deleted_at is null;
create index blog_posts_deleted_idx
  on public.blog_posts (deleted_at);

create trigger blog_posts_set_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();

alter table public.blog_posts enable row level security;

-- Editable copy for the public blog index page. Lexi can tweak from
-- /admin/content. Empty-state copy keeps the page from looking broken
-- before the first post lands.
insert into public.site_content (slug, title, body_markdown)
values
  ('blog_lede',
   'Blog page lede',
   E'Notes from the SSTA team - essays, how-tos, and dispatches from the South Sound theatre community.'),
  ('blog_empty',
   'Blog page empty state',
   E'No posts yet. Check back soon.')
on conflict (slug) do nothing;
