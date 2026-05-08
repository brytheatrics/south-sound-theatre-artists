-- 084_production_category_value.sql
--
-- Adds 'production' to the production_credit_category enum. v1.1
-- shipped with cast / creative / crew but in practice the line
-- between "creative team" and "crew" was fuzzy and caused friction
-- when tagging credits. Going to a flat cast / production split.
--
-- Postgres restriction: a newly-added enum value can't be used in
-- the same transaction it was added in (PG 12+). The data migration
-- to flip existing 'creative' and 'crew' rows to 'production' lives
-- in 085 so it runs in a fresh transaction.
--
-- The old 'creative' and 'crew' enum values stay in the enum
-- definition (Postgres can't easily drop enum values without
-- recreating the type). Application code just stops using them.

alter type public.production_credit_category add value if not exists 'production';
