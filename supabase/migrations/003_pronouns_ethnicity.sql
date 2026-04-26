-- 003_pronouns_ethnicity.sql
-- Adds optional pronouns and ethnicities to profiles + pending_submissions.
--
-- Ethnicities is an array because multiracial selections are common,
-- especially in theatre. The submission form offers a fixed checkbox list
-- plus a free-text "Add another" field so the database can hold any string.

alter table public.profiles
  add column pronouns    text,
  add column ethnicities text[] not null default '{}';

alter table public.pending_submissions
  add column pronouns    text,
  add column ethnicities text[] not null default '{}';

-- For directory filter queries
create index profiles_ethnicities_idx
  on public.profiles using gin (ethnicities);
