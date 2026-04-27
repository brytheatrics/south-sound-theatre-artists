-- 015_profiles_last_name.sql
-- Generated column extracting the last token of full_name. Used by the
-- "Name A-Z" sort on /directory and /admin/profiles so artists sort by
-- last name (theatre convention) rather than by first.
--
-- - Lowercased for stable alphabetical sort regardless of capitalisation.
-- - Single-word names (mononyms) keep the full name.
-- - Stored (not virtual) so it can be indexed cheaply.

alter table public.profiles
  add column last_name text
  generated always as (lower(regexp_replace(full_name, '^.*\s', ''))) stored;

create index if not exists profiles_last_name_idx
  on public.profiles (last_name);
