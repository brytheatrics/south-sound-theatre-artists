-- 105_org_categories_array.sql
--
-- Promote organizations.category (single text with a CHECK enum) to
-- organizations.categories (text[]) so an org can carry multiple
-- discipline / programming badges. Real-world example: TLT operates a
-- mainstage AND an educational department - both Theatre and
-- Educational Theatre belong on its /theatres card.
--
-- Approach:
--   1. Add a new categories text[] column with default empty array.
--   2. Backfill from the existing single category column for every row.
--   3. Drop the old CHECK constraint on category. Keep the column
--      around (nullable now) so any code that still reads it doesn't
--      break - the new array is authoritative going forward.
--   4. Drop the old per-category index and create one on the new
--      categories array (GIN, used by the /theatres chip filter).
--
-- The valid category values are now a free-form vocabulary: 'theatre',
-- 'educational_theatre', 'opera', 'ballet', 'symphony', 'youth',
-- 'venue', 'other'. Validation moves to the form layer so admin can
-- coin a new badge without a migration.

alter table public.organizations
  add column if not exists categories text[] not null default array[]::text[];

-- Backfill: every existing org's single category becomes a one-element array.
update public.organizations
   set categories = array[category]
 where coalesce(array_length(categories, 1), 0) = 0
   and category is not null
   and category <> '';

-- Drop the old single-value enum check so admin can edit the new array
-- without fighting a stale constraint, and relax the NOT NULL on the
-- legacy column (still useful for read-time fallback during the
-- transition; will get dropped fully in a later cleanup migration).
alter table public.organizations
  drop constraint if exists organizations_category_check;
alter table public.organizations
  alter column category drop not null;

drop index if exists organizations_category_idx;
create index if not exists organizations_categories_gin
  on public.organizations using gin (categories);

comment on column public.organizations.categories is
  'Discipline / programming badges. Drives /theatres chip filtering '
  'and per-org badge display. Multi-value: an org operating both a '
  'mainstage and an educational department lists both.';

-- Seed two new callboard post types for educational programming and
-- teaching-artist hiring. Lexi can rename / reorder via
-- /admin/callboard-types after launch.
insert into public.callboard_post_types
  (slug, label, plural_label, sort_order, glyph, marquee_prefix, active, description)
values
  (
    'youth_programming',
    'Youth programming',
    'Youth programs',
    40,
    '✦',
    'Youth program',
    true,
    'Camps, classes, summer intensives, and other student-facing educational offerings. Use this for posts a parent or young performer would respond to. To hire a designer / director / crew for an educational venue, use the relevant artist-facing type instead.'
  ),
  (
    'teaching_artist',
    'Teaching Artist',
    'Teaching Artist roles',
    45,
    '✦',
    'Teaching Artist',
    true,
    'Hiring an artist to teach, direct youth, or lead an educational program. Distinct from a regular Director call - this audience is artists who want to work with students.'
  )
on conflict (slug) do nothing;
