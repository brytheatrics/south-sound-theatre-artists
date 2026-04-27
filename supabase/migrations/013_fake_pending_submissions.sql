-- 013_fake_pending_submissions.sql
-- Seed a handful of fake email-verified submissions so /admin has rows
-- to approve / reject. Identifiable by their @dev.ssta.local emails;
-- bulk-delete with:
--   delete from pending_submissions where email like '%@dev.ssta.local';

insert into public.pending_submissions
  (email, email_verified, status, full_name, pronouns, bio, disciplines,
   geographic_area, playable_age_min, playable_age_max, languages, unions,
   ethnicities, instagram_handle, tiktok_handle, twitter_handle,
   facebook_url, linkedin_url, youtube_url, website_url, headshot_url,
   headshot_consent, desired_slug, created_at)
values

  -- 1. Full info, real-looking headshot, multi-discipline
  ('rosa@dev.ssta.local',
   true, 'pending_review',
   'Rosa Eldridge', 'she/her',
   'Stage manager and production manager working across the South Sound. Comfortable on AEA contracts and small-house volunteer rep alike. Detail-driven, calm under tech-week pressure.',
   '{"Stage Manager","Production Manager"}',
   'Tacoma',
   null, null,
   '{"English","Spanish"}',
   '{"AEA"}',
   '{"Hispanic / Latino"}',
   '@rosaSM', null, null, null, null, null,
   'https://rosaeldridge.example.com',
   null, false,
   'rosa-eldridge',
   now() - interval '2 days'),

  -- 2. Minimal info, no headshot, just required fields
  ('benji@dev.ssta.local',
   true, 'pending_review',
   'Benji Park', 'he/him',
   null,
   '{"Actor"}',
   'Olympia',
   18, 28,
   '{"English"}',
   '{}',
   '{}',
   null, null, null, null, null, null, null,
   null, false,
   'benji-park',
   now() - interval '6 hours'),

  -- 3. Custom "Other" discipline (admin should consider adding to canon)
  --    Custom area too. Several socials.
  ('avery@dev.ssta.local',
   true, 'pending_review',
   'Avery Solano', 'they/them',
   'Drag performer and burlesque producer. Bringing late-night cabaret energy to traditional theatre spaces. Open to direction, choreography, and one-off cameos.',
   '{"Performer (General)","Drag King","Choreographer"}',
   'Lakewood',
   25, 42,
   '{"English"}',
   '{"Non-Union"}',
   '{"Multiracial / Mixed","Hispanic / Latino"}',
   '@solano.cabaret', '@solano.cabaret', null,
   'https://facebook.com/avery.solano',
   null,
   'https://youtube.com/@solano-cabaret',
   null,
   null, false,
   'avery-solano',
   now() - interval '1 day'),

  -- 4. Designer with playable age range, lots of unions, full social set
  ('hana@dev.ssta.local',
   true, 'pending_review',
   'Hana Whitcomb', 'she/her',
   'Lighting designer and projection programmer. Twenty-plus shows around the South Sound. Comfortable on EOS, ION, and ETC platforms.',
   '{"Lighting Designer","Projection Designer","Master Electrician"}',
   'Gig Harbor',
   null, null,
   '{"English","French"}',
   '{"USA","IATSE"}',
   '{"White / European"}',
   '@hanawhitcomb', null, '@hanaLD',
   'https://facebook.com/hana.whitcomb',
   'https://linkedin.com/in/hanawhitcomb',
   null,
   'https://hanawhitcomb.com',
   null, false,
   'hana-whitcomb',
   now() - interval '3 days');
