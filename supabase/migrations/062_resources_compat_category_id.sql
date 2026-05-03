-- 062_resources_compat_category_id.sql
-- Compat shim: adds resources.category_id back temporarily because
-- migration 061 dropped it before the matching code change had been
-- pushed to Netlify staging. Without this, the deployed admin and
-- public pages fail querying a missing column.
--
-- Backfills from category_ids[0] (the first / primary category) so
-- the deployed code reads sensible values. Local code already reads
-- category_ids, so this column is no-op for it.
--
-- TODO once next push lands: write a follow-up migration that drops
-- category_id again now that no deployed code reads it.

alter table public.resources
  add column if not exists category_id uuid references public.resource_categories(id) on delete set null;

-- Backfill from the first entry in category_ids. Idempotent because
-- we only fill rows where category_id is currently null.
update public.resources
   set category_id = category_ids[1]
 where category_id is null
   and category_ids is not null
   and array_length(category_ids, 1) >= 1;
