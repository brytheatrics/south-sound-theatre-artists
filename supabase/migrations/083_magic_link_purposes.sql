-- 083_magic_link_purposes.sql
--
-- Extend the magic_link_tokens.purpose check constraint to cover the
-- new purposes added in v1.1:
--   - 'org_edit'      : org-edit link issued from /admin/organizations
--                       for managing cast/credits on the org's productions
--   - 'admin_invite'  : co-admin invite issued from /admin/admins
--
-- Migs 080 (admin_users) and the org-self-serve flow both started
-- inserting these purposes without realising the original 001_init
-- constraint only allowed 'edit_profile' + 'admin_2fa'. Surfaced when
-- testing the org-edit flow.

alter table public.magic_link_tokens
  drop constraint if exists magic_link_tokens_purpose_check;

alter table public.magic_link_tokens
  add constraint magic_link_tokens_purpose_check
  check (purpose in ('edit_profile', 'admin_2fa', 'org_edit', 'admin_invite'));
