-- 048_productions_submission.sql
-- Extend productions to support the public /calendar/submit flow.
-- Mirrors the callboard email-verify pattern: submission lands in
-- 'pending_email' status with a token hash; clicking the link verifies
-- the email and flips the row to 'pending_review' for admin approval.
-- Verified orgs skip review and go straight to 'approved'.

-- 1. Add submitter + verification fields
alter table public.productions
  add column if not exists submitter_email citext,
  add column if not exists email_verification_token_hash text,
  add column if not exists email_verification_expires_at timestamptz,
  add column if not exists verified_org_id uuid references public.verified_orgs(id) on delete set null;

create index if not exists productions_token_idx
  on public.productions (email_verification_token_hash);
create index if not exists productions_email_idx
  on public.productions (submitter_email);
create index if not exists productions_verified_org_idx
  on public.productions (verified_org_id);

-- 2. Expand status CHECK to allow 'pending_email'
alter table public.productions
  drop constraint if exists productions_status_check;
alter table public.productions
  add constraint productions_status_check
  check (status in ('pending_email', 'pending_review', 'approved', 'rejected'));

-- 3. Public RLS: only show approved + non-deleted productions. Same
-- policy is in mig 042; re-create idempotently to be safe across
-- environments where 042 may have been adjusted.
drop policy if exists "Public can read approved productions" on public.productions;
create policy "Public can read approved productions"
  on public.productions for select
  to anon, authenticated
  using (status = 'approved' and deleted_at is null);
