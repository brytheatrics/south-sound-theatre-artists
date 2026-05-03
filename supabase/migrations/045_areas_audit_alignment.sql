-- 045_areas_audit_alignment.sql
-- Realign the `areas` table to match the regional taxonomy used in the
-- v2.x calendar audit. The old labels were ambiguous about Pierce County
-- - "Tacoma area" was bucketing both Tacoma proper and Sumner/Puyallup
-- (South Pierce). The new structure splits these out, and renames the
-- remaining buckets for consistency.
--
-- Final list (6 areas):
--   10  Tacoma / Pierce County  (renamed from "Tacoma area")
--   20  South Pierce            (NEW)
--   30  Olympia / Thurston County (renamed from "Olympia area")
--   40  South King County       (unchanged)
--   50  Gig Harbor / Kitsap     (unchanged)
--   60  Other                   (unchanged)
--
-- Drops "Other South Sound" - the 5 specific buckets cover the audit
-- list of producing companies, and "Other" handles anyone outside the
-- region. No artists currently sit in "Other South Sound".
--
-- Cascades: profiles.geographic_area + pending_submissions.geographic_area
-- update in lockstep with the rename so no artist sees a "missing area"
-- gap on the directory or their edit page. event_sources.area_id is a
-- foreign key, so the rename leaves it valid automatically.
--
-- ManeStage's event_sources row moves Tacoma -> South Pierce as part of
-- this migration since they're physically in Sumner.

begin;

-- 1. Rename existing areas (cascades to profile data via UPDATE below).
update public.areas
   set name = 'Tacoma / Pierce County',
       description = 'Tacoma, Lakewood, University Place, JBLM',
       updated_at = now()
 where name = 'Tacoma area';

update public.profiles
   set geographic_area = 'Tacoma / Pierce County'
 where geographic_area = 'Tacoma area';
update public.pending_submissions
   set geographic_area = 'Tacoma / Pierce County'
 where geographic_area = 'Tacoma area';

update public.areas
   set name = 'Olympia / Thurston County',
       description = 'Olympia, Lacey, Tumwater',
       updated_at = now()
 where name = 'Olympia area';

update public.profiles
   set geographic_area = 'Olympia / Thurston County'
 where geographic_area = 'Olympia area';
update public.pending_submissions
   set geographic_area = 'Olympia / Thurston County'
 where geographic_area = 'Olympia area';

-- 2. Drop "Other South Sound" - no profiles use it (verified at write
-- time) and the 5 specific buckets + "Other" cover the same ground.
delete from public.areas where name = 'Other South Sound';

-- 3. Insert "South Pierce" between Tacoma and Olympia.
insert into public.areas (name, description, sort_order)
values ('South Pierce', 'Sumner, Puyallup, Bonney Lake, Orting', 20)
on conflict (name) do nothing;

-- 4. Reorder remaining areas to match the audit list. Idempotent.
update public.areas set sort_order = 10 where name = 'Tacoma / Pierce County';
update public.areas set sort_order = 30 where name = 'Olympia / Thurston County';
update public.areas set sort_order = 40 where name = 'South King County';
update public.areas set sort_order = 50 where name = 'Gig Harbor / Kitsap';
update public.areas set sort_order = 60 where name = 'Other';

-- 5. Move ManeStage from "Tacoma / Pierce County" -> "South Pierce" in
-- event_sources. Sumner is South Pierce, not Tacoma proper.
update public.event_sources
   set area_id = (select id from public.areas where name = 'South Pierce'),
       updated_at = now()
 where org_slug = 'manestage';

commit;
