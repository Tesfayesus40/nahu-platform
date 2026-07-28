-- ============================================================================
-- Nahu Platform
-- Migration : marketplace/018_marketplace_location_place_ids.sql
-- Description:
--     Add Google Place ID + optional formatted address metadata columns
--     for saved pickup locations and buyer delivery addresses.
-- ============================================================================

BEGIN;

ALTER TABLE marketplace.pickup_locations
    ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255);

ALTER TABLE marketplace.pickup_locations
    ADD COLUMN IF NOT EXISTS formatted_address VARCHAR(500);

ALTER TABLE marketplace.buyer_addresses
    ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255);

ALTER TABLE marketplace.buyer_addresses
    ADD COLUMN IF NOT EXISTS formatted_address VARCHAR(500);

COMMENT ON COLUMN marketplace.pickup_locations.google_place_id IS
'Optional Google Places place_id for map picker / future navigation.';

COMMENT ON COLUMN marketplace.buyer_addresses.google_place_id IS
'Optional Google Places place_id for map picker / future navigation.';

COMMIT;
