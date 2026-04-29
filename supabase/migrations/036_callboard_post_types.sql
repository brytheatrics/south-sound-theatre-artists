-- 036_callboard_post_types.sql
-- Admin-editable post types for the callboard. Replaces the hardcoded
-- 5-value CHECK constraint on callboard_posts.post_type. Lexi can now
-- add Workshops / Meetups / Director Calls / etc. without a code change.
--
-- Each type carries:
--   slug:            stable identifier stored on callboard_posts.post_type
--                    (kept as text to match existing rows; not renamed
--                    so existing rows don't need rewriting)
--   label:           singular display, e.g. "Audition"
--   plural_label:    plural for the filter strip, e.g. "Auditions"
--   sort_order:      controls display order on the filter strip
--   glyph:           one-character glyph for the homepage marquee
--                    ("★" for production-style, "✦" for everything else)
--   marquee_prefix:  prefix the marquee uses, e.g. "Audition", "Now
--                    playing", "Workshop". Empty = no prefix, just the
--                    title.
--   active:          soft-disable a type without deleting (existing rows
--                    keep showing in admin lists)

create table public.callboard_post_types (
  slug            text primary key,
  label           text not null,
  plural_label    text,
  sort_order      integer not null default 100,
  glyph           text not null default '✦',
  marquee_prefix  text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger callboard_post_types_set_updated_at
  before update on public.callboard_post_types
  for each row execute function public.set_updated_at();

-- Seed with the existing 5 types so nothing breaks on rollout.
insert into public.callboard_post_types
  (slug, label, plural_label, sort_order, glyph, marquee_prefix) values
  ('audition',   'Audition',                'Auditions',       10, '✦', 'Audition'),
  ('designer',   'Designer call',           'Designer calls',  20, '✦', 'Designer call'),
  ('crew',       'Crew call',               'Crew calls',      30, '✦', 'Crew call'),
  ('production', 'Production announcement', 'Production',      40, '★', 'Now playing'),
  ('general',    'General opportunity',     'General',         50, '✦', 'Opportunity')
on conflict (slug) do nothing;

-- Drop the hardcoded CHECK constraint that locked post_type to those 5
-- values. App-level validation (in the submit + admin actions) takes
-- over - both already validate against the active post-types list, so
-- bogus values can't sneak in through the form. Direct INSERTs by an
-- admin will fail with a friendlier error if the slug doesn't exist
-- because of the foreign key below.
alter table public.callboard_posts
  drop constraint if exists callboard_posts_post_type_check;

-- Foreign key prevents accidental orphans + nice error if a type is
-- removed while posts still reference it. NOT VALID first so existing
-- rows aren't re-checked.
alter table public.callboard_posts
  add constraint callboard_posts_post_type_fk
  foreign key (post_type)
  references public.callboard_post_types (slug)
  on delete restrict
  on update cascade
  not valid;

-- Validate against existing rows (they all match the seed slugs above).
alter table public.callboard_posts
  validate constraint callboard_posts_post_type_fk;

-- Public read so the public callboard list / submit form can render the
-- type tabs without a service-role round-trip.
alter table public.callboard_post_types enable row level security;
create policy "Public can read active post types"
  on public.callboard_post_types for select
  to anon, authenticated
  using (active = true);
