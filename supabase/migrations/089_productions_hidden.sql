-- 089_productions_hidden.sql
--
-- Adds `hidden_at` to productions for the admin "hide from public but
-- keep in DB" workflow. Use case: the calendar cron pulls a show from
-- a theatre's ticketing page before the theatre has formally announced
-- it. Lexi wants to suppress those rows from public surfaces (calendar
-- list, /calendar/[id]) without losing the data — once the theatre
-- announces, she clicks "Show" and it goes live.
--
-- Parallels `deleted_at` (soft-delete trash) but with different intent:
--   - deleted_at:  remove from everywhere, recoverable for 30 days
--   - hidden_at:   keep in admin, hide from public, indefinite
--
-- The cron treats `hidden_at IS NOT NULL` like `admin_edited_at` -
-- the row is admin-locked, so a re-fetch from source won't overwrite
-- fields or revive performances. That way Lexi can flip a show back
-- on with a single click and trust that her edits stuck.

alter table public.productions
  add column if not exists hidden_at timestamptz;

create index if not exists productions_hidden_at_idx
  on public.productions (hidden_at)
  where hidden_at is not null;

comment on column public.productions.hidden_at is
  'Set when admin "hides" a row from public calendar surfaces. Cron treats this like admin_edited_at and skips updates while hidden. Null = visible to public (subject to status + deleted_at filters).';
