-- ============================================================================
-- Nahu Platform
-- Migration : 005_marketplace_expand_taxonomy.sql
-- Module    : Marketplace
-- Author    : Mobile connection work (wiring nahu_buna_farmer to the backend)
-- Description:
--     Package 003 ported the coffee_grade (3 values) and process_method
--     (3 values) enums directly from nahu-buna-gebaya's V1 backend. The
--     actual nahu_buna_farmer mobile app UI supports a richer taxonomy --
--     9 grades and 7 process methods -- that the V1 backend never actually
--     had columns/enums for. This migration expands both enums to match
--     what the mobile app's pickers really offer, and adds a nullable
--     region_en column so the app's bilingual region name (it sends both
--     an Amharic 'region' and an English 'region_en') can be stored.
--
--     Enum values stay coded in English (GRADE_4, SEMI_WASHED, etc.) rather
--     than storing the Amharic display label directly -- the mobile app's
--     picker labels are UI text and may get reworded later; the stored
--     data shouldn't be coupled to that wording. The mobile-side change
--     (separately) maps each picker's Amharic/English label to one of
--     these stable codes before sending.
--
--     Postgres allows ALTER TYPE ... ADD VALUE inside a transaction as
--     long as the new value isn't used in that same transaction (PG12+),
--     so this is split into its own migration rather than bundled with
--     anything that would use these values immediately.
-- ============================================================================

BEGIN;

ALTER TYPE marketplace.coffee_grade ADD VALUE IF NOT EXISTS 'GRADE_4';
ALTER TYPE marketplace.coffee_grade ADD VALUE IF NOT EXISTS 'GRADE_5';
ALTER TYPE marketplace.coffee_grade ADD VALUE IF NOT EXISTS 'GRADE_6';
ALTER TYPE marketplace.coffee_grade ADD VALUE IF NOT EXISTS 'GRADE_7';
ALTER TYPE marketplace.coffee_grade ADD VALUE IF NOT EXISTS 'GRADE_8';
ALTER TYPE marketplace.coffee_grade ADD VALUE IF NOT EXISTS 'GRADE_9';

ALTER TYPE marketplace.process_method ADD VALUE IF NOT EXISTS 'SEMI_WASHED';
ALTER TYPE marketplace.process_method ADD VALUE IF NOT EXISTS 'HULLED';
ALTER TYPE marketplace.process_method ADD VALUE IF NOT EXISTS 'ANAEROBIC';
ALTER TYPE marketplace.process_method ADD VALUE IF NOT EXISTS 'CARBONIC_MACERATION';

COMMIT;

BEGIN;

ALTER TABLE marketplace.listings ADD COLUMN IF NOT EXISTS region_en VARCHAR(100);
ALTER TABLE marketplace.listings ADD COLUMN IF NOT EXISTS washing_station VARCHAR(150);
ALTER TABLE marketplace.listings ADD COLUMN IF NOT EXISTS cooperative VARCHAR(200);

COMMENT ON COLUMN marketplace.listings.region_en IS
'English name of the coffee origin/region, alongside the Amharic name stored in region. Provided by the mobile app''s bilingual origin picker.';

COMMENT ON COLUMN marketplace.listings.washing_station IS
'Name of the washing station the lot was processed at, as entered by the farmer in the mobile app. Free text, not a foreign key.';

COMMENT ON COLUMN marketplace.listings.cooperative IS
'Name of the cooperative associated with this specific listing, as entered by the farmer in the mobile app. Free text -- may or may not match the farmer''s registered cooperative in farmer_profiles.';

COMMIT;
