-- Allow magic_link_tokens.purpose = 'resubmit_profile' so rejected
-- pending_submissions can be reopened via a single-use token in the
-- rejection email (see rejectOne in src/routes/admin/+page.server.ts).

alter table magic_link_tokens drop constraint if exists magic_link_tokens_purpose_check;
alter table magic_link_tokens add constraint magic_link_tokens_purpose_check
  check (purpose = any (array[
    'edit_profile',
    'admin_2fa',
    'org_edit',
    'admin_invite',
    'resubmit_profile'
  ]));
