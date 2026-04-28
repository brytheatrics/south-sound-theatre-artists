-- 018_areas_description.sql
-- Add a description column to areas so the submit / edit / admin / directory
-- chips can surface "what cities this region covers" as a hover tooltip.
-- Mirrors the pattern already used on the unions table.

alter table public.areas
  add column if not exists description text;

update public.areas set description = 'Tacoma, Lakewood, Puyallup, University Place, JBLM'
  where name = 'Tacoma area';
update public.areas set description = 'Olympia, Lacey, Tumwater'
  where name = 'Olympia area';
update public.areas set description = 'Gig Harbor, Bremerton, Bainbridge, Poulsbo, Silverdale'
  where name = 'Gig Harbor / Kitsap';
update public.areas set description = 'Kent, Auburn, Burien, Federal Way, Renton'
  where name = 'South King County';
update public.areas set description = 'Anywhere else in the South Sound region'
  where name = 'Other South Sound';
update public.areas set description = 'Outside the South Sound region'
  where name = 'Other';
