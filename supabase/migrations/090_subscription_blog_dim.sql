-- 090_subscription_blog_dim.sql
--
-- Adds `include_blog` to callboard_subscriptions as the 5th opt-in
-- dimension. Per-blog-post taxonomy isn't useful (there aren't enough
-- posts for category-style filtering), so this is a single boolean
-- toggle: include new blog posts in the weekly digest, or don't.
--
-- Default policy:
--   - Existing rows backfill to false. Existing subscribers stay where
--     they are; they opt in explicitly from the manage page if they
--     want blog posts.
--   - New subscribers from the public /callboard/subscribe form default
--     to true (the form's checkbox is rendered checked) so they get
--     blog posts unless they explicitly untick.
--
-- The cron query joins this column the same way the other four
-- dimensions filter their slices: include_blog=false subscribers skip
-- the blog block entirely.

alter table public.callboard_subscriptions
  add column if not exists include_blog boolean not null default false;

comment on column public.callboard_subscriptions.include_blog is
  'When true, the weekly digest includes a section for blog posts published since the last digest. Defaults to false on backfill so existing subscribers must opt in via the manage page; the public subscribe form defaults the checkbox to checked so new subscribers land in the ON state.';
