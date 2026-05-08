-- 070_resources_cleanup.sql
--
-- PARKED: do not move into supabase/migrations/ until the multi-category
-- resources work (commits 36c0d95 + 5dab51c + 200b172) is pushed and
-- live on staging. The compat shim (mig 062 + 063) is what keeps the
-- deployed code from breaking right now; once the new code is live and
-- nothing reads `resources.category_id` anymore, run this cleanup.
--
-- To apply later:
--   1. Move this file out of `_pending/` into `supabase/migrations/`.
--   2. `pnpm db:migrate`.
--
-- Drops, in order:
--   - The trigger that mirrors category_id <- category_ids[1]
--   - The function backing it
--   - The legacy column itself

drop trigger if exists resources_sync_category_id_trg on public.resources;
drop function if exists public.resources_sync_category_id();
alter table public.resources drop column if exists category_id;
