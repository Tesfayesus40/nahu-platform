-- ============================================================================
-- Nahu Platform
-- Migration : marketplace/016_marketplace_pickup_locations.sql
-- Module    : Marketplace
-- Description:
--     Saved farmer pickup locations (address book) for listing handoff
--     enrichment. Soft-deletable; at most one default per farmer among
--     live rows. Listings may optionally reference a pickup location.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS marketplace.pickup_locations
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    farmer_profile_id UUID NOT NULL
        REFERENCES marketplace.farmer_profiles(id) ON DELETE CASCADE,

    name VARCHAR(120) NOT NULL,

    contact_name VARCHAR(150),

    contact_phone VARCHAR(30),

    address_text VARCHAR(500) NOT NULL,

    lat DECIMAL(10, 7),

    lng DECIMAL(10, 7),

    landmark VARCHAR(255),

    instructions VARCHAR(500),

    is_default BOOLEAN NOT NULL DEFAULT FALSE,

    location_kind VARCHAR(40) NOT NULL DEFAULT 'FARM'
        CHECK (location_kind IN (
            'FARM', 'WAREHOUSE', 'COLLECTION_CENTRE', 'OTHER'
        )),

    metadata_json JSONB,

    deleted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pickup_locations_farmer
    ON marketplace.pickup_locations (farmer_profile_id);

CREATE INDEX IF NOT EXISTS idx_pickup_locations_farmer_live
    ON marketplace.pickup_locations (farmer_profile_id)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pickup_locations_farmer_default
    ON marketplace.pickup_locations (farmer_profile_id)
    WHERE deleted_at IS NULL AND is_default = TRUE;

COMMENT ON TABLE marketplace.pickup_locations IS
'Saved pickup points for a farmer profile (farm, warehouse, collection centre). Soft-deleted via deleted_at.';

ALTER TABLE marketplace.listings
    ADD COLUMN IF NOT EXISTS pickup_location_id UUID
        REFERENCES marketplace.pickup_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_listings_pickup_location
    ON marketplace.listings (pickup_location_id)
    WHERE pickup_location_id IS NOT NULL;

COMMIT;
