# Pending migrations

SQL files in this folder are intentionally NOT picked up by
`pnpm db:migrate`. They're parked here when a schema change is
ready but blocked on something external — typically a deploy that
needs to land first so the live code stops referencing the column /
function we're about to drop.

## How `db:migrate` skips this folder

The runner (`scripts/migrate.mjs`) uses `readdirSync` without
recursion, so anything inside `_pending/` is invisible to it. The
parking pattern is just: drop the file in here, push, then later
move the file up one level into `supabase/migrations/` and run the
migrate command.

## Current contents

- **`070_resources_cleanup.sql`** — drops the
  `resources.category_id` column + its sync trigger / function.
  Move into `supabase/migrations/` after the multi-category
  resources work (commits `36c0d95`, `5dab51c`, `200b172`) ships
  to staging. The compat shim added by migs 062 + 063 is what's
  keeping the deployed code from breaking right now.
