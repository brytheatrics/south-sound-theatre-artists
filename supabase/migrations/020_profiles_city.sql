-- 020_profiles_city.sql
-- Add a free-text `city` field for the granular town an artist is based
-- in (Lakewood, Puyallup, Bremerton, etc.). The existing `geographic_area`
-- column stays as-is and continues to drive the region filter on the
-- public directory; `city` is a display-only refinement so a profile
-- can read "Lakewood" instead of just "Tacoma area".

alter table public.profiles
  add column city text;

alter table public.pending_submissions
  add column city text;
