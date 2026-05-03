-- 061_resources_multi_category.sql
-- Resources gain multi-category membership: a single useful resource
-- (e.g., a grant database that's useful for both producers and
-- artists) can appear under both "For artists" and "For producers"
-- without being duplicated.
--
-- Replaces the single `category_id` column with a `category_ids` uuid
-- array. Backfilled from existing category_id values so the public
-- /resources page renders identically until admin re-tags something.

alter table public.resources
  add column if not exists category_ids uuid[] not null default '{}';

-- Backfill: copy each existing single category into the array form.
-- Idempotent because we only fill rows where the array is still empty.
update public.resources
   set category_ids = array[category_id]
 where category_id is not null
   and (category_ids is null or array_length(category_ids, 1) is null);

-- GIN index so we can filter resources by category efficiently.
create index if not exists resources_category_ids_idx
  on public.resources using gin (category_ids);

-- Drop the legacy single-category column. Doing it in this same
-- migration so the schema stays clean - the column wasn't being read
-- after this migration applies; both admin + public pages get
-- updated in the matching code change.
alter table public.resources
  drop column if exists category_id;
