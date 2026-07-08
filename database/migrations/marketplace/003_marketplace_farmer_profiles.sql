-- ============================================================================
-- Nahu Platform
-- Migration : 003_marketplace_farmer_profiles.sql
-- Module    : Marketplace
-- Author    : Package 003 (Marketplace)
-- Description:
--     Creates marketplace.farmer_profiles. Ported from nahu-buna-gebaya's
--     Knex migration 003_create_farmer_profiles, with two deliberate
--     changes to fit the new Identity module:
--       - user_id now references identity.users(id) instead of a local
--         users table -- Identity owns who a user is, Marketplace owns
--         what their farmer profile looks like.
--       - primary_language uses the same 2-letter codes as
--         identity.users.preferred_language (en, am, om, ti, so) instead
--         of the original free-text 'amharic' default, for consistency
--         across the platform.
-- ============================================================================

BEGIN;

CREATE TABLE marketplace.farmer_profiles
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL UNIQUE,

    cooperative_id UUID,

    region VARCHAR(100) NOT NULL,

    zone VARCHAR(100),

    woreda VARCHAR(100),

    altitude_m NUMERIC(6,1),

    farm_size_ha NUMERIC(6,2),

    primary_language CHAR(2) NOT NULL DEFAULT 'am',

    verified BOOLEAN NOT NULL DEFAULT FALSE,

    verification_notes VARCHAR(500),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_farmer_profiles_user
        FOREIGN KEY (user_id)
        REFERENCES identity.users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_farmer_profiles_cooperative
        FOREIGN KEY (cooperative_id)
        REFERENCES marketplace.cooperatives(id)
        ON DELETE SET NULL
);

COMMENT ON TABLE marketplace.farmer_profiles IS
'Farmer-specific profile data, one row per identity.users row with the FARMER role.';

COMMENT ON COLUMN marketplace.farmer_profiles.user_id IS
'References identity.users(id) -- Identity owns the account, Marketplace owns the farm profile.';

COMMIT;
