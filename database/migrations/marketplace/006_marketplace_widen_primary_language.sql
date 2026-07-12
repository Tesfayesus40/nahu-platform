-- ============================================================================
-- Nahu Platform
-- Migration : 006_marketplace_widen_primary_language.sql
-- Module    : Marketplace
-- Author    : Mobile connection work (round 2)
-- Description:
--     farmer_profiles.primary_language was CHAR(2), meant for a single
--     ISO-style language code. The mobile app's actual profile screen
--     lets a farmer select MULTIPLE languages they speak (Amharic,
--     Oromiffa, Sidamigna, etc.) via checkboxes, and sends them as a
--     comma-joined string of the Amharic display labels (e.g.
--     "አማርኛ,ኦሮሚፋ") -- not a single 2-letter code. CHAR(2) could never
--     have held this. Widened to VARCHAR(200) to actually fit it.
-- ============================================================================

BEGIN;

ALTER TABLE marketplace.farmer_profiles
    ALTER COLUMN primary_language TYPE VARCHAR(200),
    ALTER COLUMN primary_language SET DEFAULT 'am';

COMMENT ON COLUMN marketplace.farmer_profiles.primary_language IS
'Comma-joined list of languages the farmer speaks, as selected in the mobile app (free text display labels, not coded values -- e.g. "አማርኛ,ኦሮሚፋ").';

COMMIT;
