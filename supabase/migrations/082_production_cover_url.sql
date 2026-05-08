-- 082_production_cover_url.sql
--
-- Optional poster / cover image for a production. Submitted via the
-- public /calendar/submit form (Cloudinary upload to the `posters`
-- folder). Rendered hero-style on /calendar/[id] when set, also used
-- as the OG image on the same page for social sharing.

alter table public.productions
  add column cover_url text;

-- No index needed: cover_url is rendered alongside the existing
-- production row, never queried in isolation.
