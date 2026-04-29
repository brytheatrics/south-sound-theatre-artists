-- 037_callboard_post_types_description.sql
-- Adds the per-type submit-form description (e.g. "Open casting call
-- for a show." under "Audition") that the submit form renders inline.
-- Seeded for the original 5 with the existing copy; new types get
-- whatever Lexi types into the admin form.

alter table public.callboard_post_types
  add column if not exists description text;

update public.callboard_post_types
  set description = case slug
    when 'audition'   then 'Open casting call for a show.'
    when 'designer'   then 'Looking for a scenic, lighting, costume, sound, or other designer.'
    when 'crew'       then 'Stage manager, ASM, carpenter, stitcher, run crew, etc.'
    when 'production' then 'Announcing a show - dates, tickets, info.'
    when 'general'    then 'Workshop, class, staged reading, anything else.'
  end
  where slug in ('audition', 'designer', 'crew', 'production', 'general');
