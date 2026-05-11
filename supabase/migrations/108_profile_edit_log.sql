-- Audit log for every save on a profile row, regardless of editor kind
-- (artist via magic link, admin via /admin/profiles/[id]/edit, org via
-- org-edit). One row per save with the jsonb diff of changed fields.
-- Used by /admin/recent-edits to show "who changed what, when."
--
-- Schema notes:
--   - changes shape: { field_name: { old: <value>, new: <value> } }.
--     Only changed fields are stored, not the whole row. Reduces storage
--     churn + makes the diff easy to render.
--   - edited_by_kind: who did the save. 'artist' = magic link self-edit;
--     'admin' = an admin via the admin profile editor; 'org' = a verified
--     org rep editing their roster via org-edit (when wired up).
--   - edited_by_email: email of the admin/org that did the edit when
--     available (for the artist path it's the profile's own email and
--     redundant, so we leave it null there).
--   - history starts at this migration's apply time; pre-existing edits
--     aren't backfilled.

create table profile_edit_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  edited_by_kind text not null check (edited_by_kind in ('artist', 'admin', 'org')),
  edited_by_email text,
  changes jsonb not null,
  edited_at timestamp with time zone not null default now()
);

create index profile_edit_log_profile_id_idx on profile_edit_log (profile_id);
create index profile_edit_log_edited_at_idx on profile_edit_log (edited_at desc);
