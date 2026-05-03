-- 063_resources_category_sync_trigger.sql
-- Keep resources.category_id auto-synced to category_ids[1] until the
-- code change in 36c0d95 deploys to staging. Without this, edits hit
-- one column and leave the other stale, which means /resources on
-- staging (which still reads category_id) shows out-of-date tags.
--
-- The trigger runs BEFORE INSERT OR UPDATE so the row goes in / gets
-- updated atomically. Once we push and drop category_id again, drop
-- this trigger too (it's referenced in the rollback migration).

create or replace function public.resources_sync_category_id() returns trigger as $$
begin
  -- Mirror the first category in category_ids onto the legacy
  -- category_id column. Empty array (or null) -> null.
  if new.category_ids is null or array_length(new.category_ids, 1) is null then
    new.category_id := null;
  else
    new.category_id := new.category_ids[1];
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists resources_sync_category_id_trg on public.resources;
create trigger resources_sync_category_id_trg
  before insert or update on public.resources
  for each row
  execute function public.resources_sync_category_id();
