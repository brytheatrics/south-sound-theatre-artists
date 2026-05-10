-- 106_callboard_production_team.sql
--
-- Consolidates the separate `designer` + `crew` callboard post types
-- into a single `production_team` type. Reasoning: most callboard
-- posts that hire designers also hire stage managers / props /
-- run-crew on the same post (TLT's 2026-27 season call is the
-- proximate example - mixing Costume Designer + Stage Manager +
-- Scenic Artist Apprentice in one listing). Two post types forced
-- a fake either/or; one combined type matches reality.
--
-- Approach:
--   1. Insert the new `production_team` post type at sort_order 20
--      (taking designer's old slot so the form ordering doesn't jump
--      around). Skip if it already exists - re-runs no-op.
--   2. Update every existing callboard_posts row whose post_type is
--      'designer' or 'crew' to 'production_team'. The post_type
--      column has no FK constraint (mig 036 dropped the CHECK), so
--      this is a plain text rewrite.
--   3. Mark designer + crew rows as inactive (active=false) so the
--      submit form's `eq("active", true)` filter hides them. We
--      keep the rows around for historical readability of any
--      email_log entries that reference them; admin can hard-delete
--      via /admin/callboard-types if she wants.

insert into public.callboard_post_types
  (slug, label, plural_label, sort_order, glyph, marquee_prefix, active, description)
values
  (
    'production_team',
    'Production team',
    'Production team',
    20,
    '✦',
    'Production team',
    true,
    'Designers, stage managers, technicians, props, run crew, and other show production roles.'
  )
on conflict (slug) do nothing;

update public.callboard_posts
   set post_type = 'production_team'
 where post_type in ('designer', 'crew');

update public.callboard_post_types
   set active = false
 where slug in ('designer', 'crew');
