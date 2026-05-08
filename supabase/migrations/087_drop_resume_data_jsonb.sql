-- 087_drop_resume_data_jsonb.sql
--
-- Final cleanup of the multi-resume migration. Mig 078 split
-- profiles.resume_data jsonb into proper relational tables (resumes +
-- resume_entries) but kept the jsonb column populated as a backwards-
-- compat shim, synced via syncLegacyResumeData() after every mutation.
--
-- We're pre-launch and the new tables are working. The jsonb column is
-- now pure dead weight + a footgun (admin/profiles/new was still
-- writing to it as a side-channel; bulk-import wasn't, leaving recently
-- imported profiles with mismatched data). Code that depends on the
-- column was removed; this migration drops it.
--
-- Audited reads before running:
--   - /artists/[slug]/+page.server.ts: SELECT no longer includes
--     resume_data; renders from resumes + resume_entries.
--   - /admin/+page.server.ts + +page.svelte: reads resume_data from
--     `pending_submissions`, NOT `profiles`. Different table; not
--     affected.
--   - /admin/profiles/new/+page.server.ts: stops writing resume_data
--     to the new profile row; still reads pending_submissions.resume_data
--     to feed expandLegacyResumeData() (which inserts into the new
--     relational tables).
--   - /admin/flagged-edits/*: reads from flagged_edits.proposed_changes
--     jsonb, NOT profiles. Not affected.

alter table public.profiles
  drop column if exists resume_data;
