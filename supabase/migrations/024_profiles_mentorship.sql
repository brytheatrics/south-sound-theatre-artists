-- 024_profiles_mentorship.sql
-- v1.1: two mentorship arrays on profiles - disciplines an artist is
-- offering to mentor in, and disciplines they're looking to learn.
-- Empty arrays = not participating in mentorship; both filters surface
-- non-empty rows. Uses discipline names (not IDs) to match the
-- existing disciplines/unions/ethnicities array pattern on this table.

alter table public.profiles
  add column mentorship_offering text[] not null default '{}',
  add column mentorship_seeking text[] not null default '{}';

alter table public.pending_submissions
  add column mentorship_offering text[] not null default '{}',
  add column mentorship_seeking text[] not null default '{}';

-- Index for the directory's "open to mentoring" / "looking to learn"
-- filter chips. GIN array indexes make `array_length > 0` and
-- `&& array['x']` queries cheap.
create index profiles_mentorship_offering_idx
  on public.profiles using gin (mentorship_offering);
create index profiles_mentorship_seeking_idx
  on public.profiles using gin (mentorship_seeking);
