-- 019_disciplines_expand.sql
-- Bulk-add the canonical theatre discipline list. Each insert uses
-- ON CONFLICT (name) DO NOTHING so this migration is safe to re-run and
-- doesn't trample existing rows that an admin may have already edited.
--
-- One rename: "Actor" -> "Actor (Stage)" so it disambiguates from Voice
-- Actor / Motion Capture Performer. Profile.disciplines arrays are
-- updated in lockstep.

-- 1. Rename "Actor" everywhere it's referenced.
update public.profiles
  set disciplines = array_replace(disciplines, 'Actor', 'Actor (Stage)')
  where 'Actor' = any(disciplines);

update public.pending_submissions
  set disciplines = array_replace(disciplines, 'Actor', 'Actor (Stage)')
  where 'Actor' = any(disciplines);

update public.disciplines set name = 'Actor (Stage)' where name = 'Actor';

-- 2. Bulk insert. sort_order is grouped per category in tens so admins
-- can squeeze new entries between existing ones without renumbering.

insert into public.disciplines (name, category, sort_order) values
  -- Performance
  ('Actor (Stage)',                   'Performance', 10),
  ('Musical Theatre Performer',       'Performance', 20),
  ('Singer / Vocalist',               'Performance', 30),
  ('Dancer',                          'Performance', 40),
  ('Ensemble Performer',              'Performance', 50),
  ('Understudy',                      'Performance', 60),
  ('Swing',                           'Performance', 70),
  ('Puppeteer',                       'Performance', 80),
  ('Voice Actor',                     'Performance', 90),
  ('Drag Queen',                      'Performance', 100),
  ('Drag King',                       'Performance', 110),
  ('Motion Capture Performer',        'Performance', 120),
  ('Improviser',                      'Performance', 130),
  ('Clown / Physical Comedian',       'Performance', 140),
  ('Circus Performer',                'Performance', 150),
  ('Magician / Illusionist',          'Performance', 160),
  ('Performance Artist',              'Performance', 170),

  -- Direction & Leadership
  ('Director',                        'Direction & Leadership', 10),
  ('Assistant Director',              'Direction & Leadership', 20),
  ('Associate Director',              'Direction & Leadership', 30),
  ('Artistic Director',               'Direction & Leadership', 40),
  ('Resident Director',               'Direction & Leadership', 50),
  ('Choreographer',                   'Direction & Leadership', 60),
  ('Assistant Choreographer',         'Direction & Leadership', 70),
  ('Movement Director',               'Direction & Leadership', 80),
  ('Intimacy Director',               'Direction & Leadership', 90),
  ('Intimacy Coordinator',            'Direction & Leadership', 100),
  ('Fight Director',                  'Direction & Leadership', 110),
  ('Fight Choreographer',             'Direction & Leadership', 120),
  ('Music Director',                  'Direction & Leadership', 130),
  ('Associate Music Director',        'Direction & Leadership', 140),
  ('Conductor',                       'Direction & Leadership', 150),

  -- Music & Sound
  ('Composer',                        'Music & Sound', 10),
  ('Lyricist',                        'Music & Sound', 20),
  ('Sound Designer',                  'Music & Sound', 30),
  ('Associate Sound Designer',        'Music & Sound', 40),
  ('Music Supervisor',                'Music & Sound', 50),
  ('Orchestrator',                    'Music & Sound', 60),
  ('Arranger',                        'Music & Sound', 70),
  ('Rehearsal Pianist',               'Music & Sound', 80),
  ('Pit Musician',                    'Music & Sound', 90),

  -- Design
  ('Scenic Designer',                 'Design', 10),
  ('Assistant Scenic Designer',       'Design', 20),
  ('Set Decorator',                   'Design', 30),
  ('Props Designer',                  'Design', 40),
  ('Lighting Designer',               'Design', 50),
  ('Associate Lighting Designer',     'Design', 60),
  ('Projection Designer',             'Design', 70),
  ('Video Designer',                  'Design', 80),
  ('Costume Designer',                'Design', 90),
  ('Associate Costume Designer',      'Design', 100),
  ('Wig Designer',                    'Design', 110),
  ('Hair Designer',                   'Design', 120),
  ('Makeup Designer',                 'Design', 130),
  ('Special Effects Designer',        'Design', 140),

  -- Technical & Production
  ('Technical Director',              'Technical & Production', 10),
  ('Assistant Technical Director',    'Technical & Production', 20),
  ('Production Manager',              'Technical & Production', 30),
  ('Company Manager',                 'Technical & Production', 40),
  ('Stage Manager',                   'Technical & Production', 50),
  ('Assistant Stage Manager',         'Technical & Production', 60),
  ('Production Stage Manager',        'Technical & Production', 70),
  ('Deck Stage Manager',              'Technical & Production', 80),
  ('Run Crew',                        'Technical & Production', 90),
  ('Deck Crew',                       'Technical & Production', 100),
  ('Fly Crew',                        'Technical & Production', 110),
  ('Automation Operator',             'Technical & Production', 120),
  ('Theatrical Rigger',               'Technical & Production', 130),
  ('Scenic Carpenter',                'Technical & Production', 140),
  ('Master Carpenter',                'Technical & Production', 150),
  ('Theatrical Electrician',          'Technical & Production', 160),
  ('Master Electrician',              'Technical & Production', 170),
  ('Light Board Operator',            'Technical & Production', 180),
  ('Sound Board Operator',            'Technical & Production', 190),
  ('Follow Spot Operator',            'Technical & Production', 200),
  ('A1 / Sound Engineer',             'Technical & Production', 210),
  ('Video Engineer',                  'Technical & Production', 220),
  ('Props Artisan',                   'Technical & Production', 230),
  ('Props Master',                    'Technical & Production', 240),
  ('Scenic Artist / Painter',         'Technical & Production', 250),
  ('Charge Scenic Artist',            'Technical & Production', 260),
  ('Costume Shop Manager',            'Technical & Production', 270),
  ('Stitcher / Seamstress / Tailor',  'Technical & Production', 280),
  ('Wardrobe Supervisor',             'Technical & Production', 290),
  ('Dresser',                         'Technical & Production', 300),
  ('Hair & Wig Technician',           'Technical & Production', 310),
  ('Makeup Artist (Run Crew)',        'Technical & Production', 320),

  -- Specialty & Effects
  ('Special Effects Technician',      'Specialty & Effects', 10),
  ('Pyrotechnician',                  'Specialty & Effects', 20),
  ('Weapons Master',                  'Specialty & Effects', 30),
  ('Armorer',                         'Specialty & Effects', 40),
  ('Automation Programmer',           'Specialty & Effects', 50),
  ('Show Control Programmer',         'Specialty & Effects', 60),
  ('Robotics Technician',             'Specialty & Effects', 70),
  ('Illusion Designer',               'Specialty & Effects', 80),
  ('Blood Effects Specialist',        'Specialty & Effects', 90),

  -- Creative & Development
  ('Playwright',                      'Creative & Development', 10),
  ('Deviser',                         'Creative & Development', 20),
  ('Dramaturg',                       'Creative & Development', 30),
  ('Script Doctor',                   'Creative & Development', 40),
  ('Translator (Theatre)',            'Creative & Development', 50),
  ('Adapter',                         'Creative & Development', 60),
  ('Cultural Consultant',             'Creative & Development', 70),
  ('Sensitivity Reader',              'Creative & Development', 80),

  -- Education & Coaching
  ('Acting Coach',                    'Education & Coaching', 10),
  ('Vocal Coach',                     'Education & Coaching', 20),
  ('Dialect Coach',                   'Education & Coaching', 30),
  ('Movement Coach',                  'Education & Coaching', 40),
  ('Teaching Artist',                 'Education & Coaching', 50),
  ('Workshop Facilitator',            'Education & Coaching', 60),

  -- Accessibility & Inclusion
  ('ASL Interpreter',                 'Accessibility & Inclusion', 10),
  ('Live Captioner',                  'Accessibility & Inclusion', 20),
  ('Audio Description Narrator',      'Accessibility & Inclusion', 30),
  ('Accessibility Coordinator',       'Accessibility & Inclusion', 40),

  -- Admin, Producing & Front of House
  ('Producer',                        'Admin, Producing & Front of House', 10),
  ('Executive Producer',              'Admin, Producing & Front of House', 20),
  ('Line Producer',                   'Admin, Producing & Front of House', 30),
  ('Associate Producer',              'Admin, Producing & Front of House', 40),
  ('Development Director',            'Admin, Producing & Front of House', 50),
  ('Grant Writer',                    'Admin, Producing & Front of House', 60),
  ('Tour Manager',                    'Admin, Producing & Front of House', 70),
  ('General Manager',                 'Admin, Producing & Front of House', 80),
  ('Casting Director',                'Admin, Producing & Front of House', 90),
  ('Casting Associate',               'Admin, Producing & Front of House', 100),
  ('Marketing Director',              'Admin, Producing & Front of House', 110),
  ('Publicist',                       'Admin, Producing & Front of House', 120),
  ('Graphic Designer',                'Admin, Producing & Front of House', 130),
  ('Production Photographer',         'Admin, Producing & Front of House', 140),
  ('Videographer / Archivist',        'Admin, Producing & Front of House', 150),
  ('Box Office Manager',              'Admin, Producing & Front of House', 160),
  ('House Manager',                   'Admin, Producing & Front of House', 170),
  ('Front of House Staff',            'Admin, Producing & Front of House', 180),
  ('Usher',                           'Admin, Producing & Front of House', 190),

  -- Digital / Emerging
  ('Projection Programmer',           'Digital / Emerging', 10),
  ('Media Server Operator',           'Digital / Emerging', 20),
  ('Video Content Creator',           'Digital / Emerging', 30),
  ('Livestream Technician',           'Digital / Emerging', 40),
  ('AV Technician',                   'Digital / Emerging', 50),
  ('LED Wall Designer / Operator',    'Digital / Emerging', 60),
  ('Interactive Media Designer',      'Digital / Emerging', 70),
  ('XR / Virtual Production Designer','Digital / Emerging', 80),

  -- Multi-Discipline / Catch-All
  ('Designer (General)',              'Multi-Discipline / Catch-All', 10),
  ('Technician (General)',            'Multi-Discipline / Catch-All', 20),
  ('Performer (General)',             'Multi-Discipline / Catch-All', 30),
  ('Director / Choreographer',        'Multi-Discipline / Catch-All', 40)
on conflict (name) do nothing;
