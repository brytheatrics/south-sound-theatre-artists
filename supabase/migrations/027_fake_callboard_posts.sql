-- 027_fake_callboard_posts.sql
-- Seed a handful of approved callboard posts (and a couple of verified
-- producing companies) so the public board, filters, and "closing soon"
-- strip have something to render in dev. Identifiable by the
-- @dev.ssta.local submitter emails. Bulk-delete with:
--   delete from callboard_posts where submitter_email like '%@dev.ssta.local';
--   delete from verified_orgs    where contact_email  like '%@dev.ssta.local';

-- =====================================================================
-- Verified orgs (a couple, so some posts can show the verified checkmark)
-- =====================================================================
with org_inserts as (
  insert into public.verified_orgs (name, contact_email, website_url, description, verified)
  values
    ('Tacoma Little Theatre', 'casting@tlt.dev.ssta.local',
     'https://tacomalittletheatre.com',
     'Tacoma''s long-running community theatre, est. 1918.', true),
    ('Harlequin Productions', 'auditions@harlequin.dev.ssta.local',
     'https://harlequinproductions.org',
     'Olympia-based professional company at the State Theater.', true)
  returning id, name
)
-- Stash the IDs in a temp table so the inserts below can reference them.
select 1 into temp _orgs_seeded from org_inserts limit 1;

-- =====================================================================
-- Callboard posts
-- All approved + published so they appear on /callboard immediately.
-- Mix of types, locations across the South Sound, and a few tied to
-- verified orgs. expires_at spread so the "closing this week" strip has
-- a couple of entries.
-- =====================================================================
insert into public.callboard_posts
  (post_type, title, organization_name, location, description, roles,
   compensation_type, compensation, contact_info, key_dates, deadline_text,
   expires_at, ticket_url, submitter_email, verified_org_id, status,
   published, created_at)
values

  -- 1. Audition (verified) - Tacoma Little Theatre, closing this week
  ('audition',
   'Auditions: Steel Magnolias',
   'Tacoma Little Theatre',
   'Tacoma',
   'Open auditions for our spring run of Robert Harling''s Steel Magnolias. Looking for six women, ages 20s to 60s, to play the regulars at Truvy''s beauty parlor. Cold reads from sides; please prepare a 60-second contemporary monologue. Callbacks the following week.',
   '{"Truvy (40s, salon owner)","Annelle (20s, new to town)","Clairee (60s, mayor''s widow)","Shelby (20s-30s, bride)","M''Lynn (40s-50s, Shelby''s mother)","Ouiser (60s, neighbor)"}',
   'stipend', 'Stipend $400 per actor',
   'Sign up for an audition slot at tacomalittletheatre.com/auditions',
   '[["Auditions","May 4-5"],["Callbacks","May 11"],["Rehearsals","Begin May 20"],["Run","July 18 - Aug 4"]]'::jsonb,
   'Sign up by May 3',
   now() + interval '5 days',
   null,
   'casting@tlt.dev.ssta.local',
   (select id from public.verified_orgs where contact_email = 'casting@tlt.dev.ssta.local'),
   'approved', true,
   now() - interval '2 days'),

  -- 2. Designer call (verified) - Harlequin
  ('designer',
   'Lighting Designer - The Lehman Trilogy',
   'Harlequin Productions',
   'Olympia',
   'Seeking a lighting designer for our fall production of Stefano Massini''s The Lehman Trilogy. Three-actor staging on a thrust, with significant projection-driven scenes. Looking for someone comfortable working alongside our resident projection designer. Equity stage. Mentorship available for emerging designers.',
   '{"Lighting Designer"}',
   'paid', '$2,800 design fee + per-diem during tech',
   'Send resume + portfolio link to auditions@harlequinproductions.org',
   '[["Design meetings","June 10"],["Load-in","Sept 3"],["Tech","Sept 15-22"],["Run","Sept 26 - Oct 19"]]'::jsonb,
   'Apply by May 25',
   now() + interval '27 days',
   null,
   'auditions@harlequin.dev.ssta.local',
   (select id from public.verified_orgs where contact_email = 'auditions@harlequin.dev.ssta.local'),
   'approved', true,
   now() - interval '5 days'),

  -- 3. Crew call (unverified) - small Gig Harbor company
  ('crew',
   'Stage Manager & ASM - Murder on the Orient Express',
   'Paradise Theatre',
   'Gig Harbor',
   'Looking for a stage manager and an assistant stage manager for our summer production of Agatha Christie''s Murder on the Orient Express. Cast of 13, complex blocking and lots of period prop tracking. Comfortable theatre, supportive team, paid position.',
   '{"Stage Manager","Assistant Stage Manager"}',
   'paid', '$22/hr',
   'Email rachel@paradisetheatre.example.org with availability and a brief resume.',
   '[["Pre-pro","June 15"],["Rehearsals","July 1"],["Run","Aug 8 - Sept 1"]]'::jsonb,
   'Open until filled',
   now() + interval '60 days',
   null,
   'rachel-sm@dev.ssta.local',
   null,
   'approved', true,
   now() - interval '1 day'),

  -- 4. Production announcement (verified) - TLT
  ('production',
   'Now playing: Sense and Sensibility',
   'Tacoma Little Theatre',
   'Tacoma',
   'Kate Hamill''s acclaimed adaptation of Jane Austen''s beloved novel. A whirl of gossip, heartbreak, and unexpected humour. Directed by Sue Driskell. Two more weekends only.',
   '{}',
   null, null,
   null,
   '[["Performances","Fri-Sun, 7:30pm"],["Matinee","Sun 2:00pm"],["Closes","May 12"]]'::jsonb,
   'Through May 12',
   now() + interval '14 days',
   'https://tacomalittletheatre.com/sense-and-sensibility',
   'casting@tlt.dev.ssta.local',
   (select id from public.verified_orgs where contact_email = 'casting@tlt.dev.ssta.local'),
   'approved', true,
   now() - interval '8 days'),

  -- 5. General opportunity - workshop, no expiry, no comp
  ('general',
   'Free voice & dialect workshop with Marisa Tornello',
   'South Sound Voice Collective',
   'Lakewood',
   'A free two-hour drop-in voice and dialect workshop hosted at Lakewood Playhouse. Open to all experience levels. Bring a 30-second monologue if you''d like personalized feedback; observers welcome. Light snacks provided.',
   '{}',
   'volunteer', 'Free workshop - donations welcome',
   'RSVP at southsoundvoice.example.org/may-workshop',
   '[["Date","Saturday, May 18"],["Time","2:00 - 4:00pm"],["Location","Lakewood Playhouse rehearsal room"]]'::jsonb,
   'Drop-in - no deadline',
   now() + interval '20 days',
   null,
   'sscollective@dev.ssta.local',
   null,
   'approved', true,
   now() - interval '3 days'),

  -- 6. Audition (unverified) - small Steilacoom company, closing this week
  ('audition',
   'Auditions: A Midsummer Night''s Dream (outdoor, all-ages)',
   'Steilacoom Summer Stage',
   'Steilacoom',
   'Casting our annual outdoor Shakespeare. Welcoming actors of all ages and experience levels - this is a community-first production with a focus on access. Roles for 12-15 actors, some doubling. Rehearsals run weekday evenings + Saturday afternoons.',
   '{"Hermia","Lysander","Helena","Demetrius","Puck","Bottom","Titania","Oberon","Mechanicals (4)","Fairies (open ensemble)"}',
   'volunteer', 'Volunteer - small honorarium for leads',
   'Sign up: steilacoomsummerstage.example.org/auditions',
   '[["Auditions","May 8-9, 6-9pm"],["Callbacks","May 11"],["Performances","Aug 1-17, in the park"]]'::jsonb,
   'Sign up by May 7',
   now() + interval '6 days',
   null,
   'sss-casting@dev.ssta.local',
   null,
   'approved', true,
   now() - interval '4 days'),

  -- 7. Crew call (verified) - Harlequin scenic carpenter
  ('crew',
   'Scenic carpenter - The Lehman Trilogy build',
   'Harlequin Productions',
   'Olympia',
   'Joining our scenic crew for the Lehman Trilogy build. Comfortable working from drafted plates, basic platform / flat construction, and finish carpentry. Day rates competitive with regional theatre standards. Roughly 4 weeks of work in late summer.',
   '{"Scenic Carpenter (2 needed)"}',
   'paid', '$24-28/hr DOE',
   'Email shop@harlequinproductions.org with availability and a brief work history.',
   '[["Build start","Aug 5"],["Load-in","Sept 3"]]'::jsonb,
   'Apply by July 1',
   now() + interval '64 days',
   null,
   'shop-harlequin@dev.ssta.local',
   (select id from public.verified_orgs where contact_email = 'auditions@harlequin.dev.ssta.local'),
   'approved', true,
   now() - interval '6 days');
