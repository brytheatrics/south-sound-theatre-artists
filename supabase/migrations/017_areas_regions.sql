-- 017_areas_regions.sql
-- Refactor the area picker from "single city" to "region with anchor city".
-- Old: Tacoma / Olympia / Gig Harbor / Other South Sound / Other
-- New: Tacoma area / Olympia area / Gig Harbor / Kitsap / South King County
--      / Other South Sound / Other
--
-- Profiles already in the system get their geographic_area string remapped
-- to the new labels.

-- 1. Remap profile values to the new labels.
update public.profiles set geographic_area = 'Tacoma area'
  where geographic_area = 'Tacoma';
update public.profiles set geographic_area = 'Olympia area'
  where geographic_area = 'Olympia';
update public.profiles set geographic_area = 'Gig Harbor / Kitsap'
  where geographic_area = 'Gig Harbor';
-- 'Other South Sound' and 'Other' stay as-is.

-- Same for pending_submissions if any are mid-review.
update public.pending_submissions set geographic_area = 'Tacoma area'
  where geographic_area = 'Tacoma';
update public.pending_submissions set geographic_area = 'Olympia area'
  where geographic_area = 'Olympia';
update public.pending_submissions set geographic_area = 'Gig Harbor / Kitsap'
  where geographic_area = 'Gig Harbor';

-- 2. Replace the areas table contents with the new set + ordering.
delete from public.areas;
insert into public.areas (name, sort_order) values
  ('Tacoma area',         10),
  ('Olympia area',        20),
  ('Gig Harbor / Kitsap', 30),
  ('South King County',   40),
  ('Other South Sound',   50),
  ('Other',               60);
