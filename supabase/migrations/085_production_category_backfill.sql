-- 085_production_category_backfill.sql
--
-- Companion to 084: now that 'production' is a committed enum value,
-- migrate existing creative + crew rows into it.

update public.production_credits
   set category = 'production'
 where category in ('creative', 'crew');
