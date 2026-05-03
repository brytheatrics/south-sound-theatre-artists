-- 047_drop_production_from_callboard.sql
-- Soft-deactivate the 'production' callboard post type. Per the v2.x
-- product decision, performances live on /calendar exclusively;
-- callboard ("Opportunities") is for hiring/talent calls only.
--
-- The slug stays in the table because there are no existing production
-- posts in the DB (audited at write time on 2026-05-03), but the
-- foreign key constraint on callboard_posts.post_type means we keep the
-- row defensively in case any seed/test data references it. Setting
-- active=false hides it from:
--   - the public /callboard filter strip (active=true RLS policy)
--   - the /callboard/submit post-type picker (load filters active=true)
--
-- Admin-side queries (supabaseAdmin) still see the type so any
-- existing production-typed posts keep rendering in trash / lists.
--
-- The marquee logic that previously injected "Now playing" production
-- callboard posts will simply find none and silently fall through.
-- The natural successor is the homepage marquee pulling from /calendar
-- directly (planned for a follow-up after Phase C lands).

update public.callboard_post_types
   set active = false,
       updated_at = now()
 where slug = 'production';
