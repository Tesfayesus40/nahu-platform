-- ============================================================================
-- Nahu Platform
-- Migration : 001_marketplace_schema.sql
-- Module    : Marketplace
-- Author    : Package 003 (Marketplace)
-- Description:
--     Creates the marketplace schema. Ported from nahu-buna-gebaya's flat
--     public-schema tables (cooperatives, farmer_profiles, listings),
--     moved into their own schema per the platform's modular architecture
--     principle. farmer_profiles.user_id references identity.users(id) --
--     Marketplace depends on Identity for who a user is, but owns
--     everything about what a farmer/listing looks like.
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS marketplace;

COMMENT ON SCHEMA marketplace IS
'Coffee marketplace module for Nahu Platform (listings, farmer profiles, cooperatives). Ported from nahu-buna-gebaya.';

COMMIT;
