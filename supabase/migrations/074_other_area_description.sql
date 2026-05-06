-- 074_other_area_description.sql
-- Update the "Other" area's description to be the user-facing tagline
-- now that "Other" is a self-sufficient pick on the submit / edit forms
-- (no longer requires a follow-up "specify location" string). Renders
-- as the inline description after the option name in the area select,
-- and as the hover tooltip on the directory's area chip.

update public.areas
   set description = 'Anywhere outside the South Sound',
       updated_at = now()
 where name = 'Other';
