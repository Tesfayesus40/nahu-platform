-- ============================================================================
-- Nahu Platform
-- Migration : 004_marketplace_listings.sql
-- Module    : Marketplace
-- Author    : Package 003 (Marketplace)
-- Description:
--     Creates marketplace.listings. Direct port of nahu-buna-gebaya's Knex
--     migration 004_create_listings, unchanged in shape except the enum
--     values for grade are uppercased with underscores (GRADE_1 instead of
--     "Grade 1") to be valid Postgres/Prisma enum identifiers -- the API
--     still accepts/returns them as-is, this only affects the raw DB enum
--     labels.
-- ============================================================================

BEGIN;

CREATE TYPE marketplace.process_method AS ENUM
(
    'WASHED',
    'NATURAL',
    'HONEY'
);

CREATE TYPE marketplace.coffee_grade AS ENUM
(
    'GRADE_1',
    'GRADE_2',
    'GRADE_3'
);

CREATE TYPE marketplace.listing_status AS ENUM
(
    'ACTIVE',
    'RESERVED',
    'SOLD',
    'CANCELLED'
);

CREATE TABLE marketplace.listings
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    farmer_id UUID NOT NULL,

    region VARCHAR(100) NOT NULL,

    woreda VARCHAR(100),

    process_method marketplace.process_method NOT NULL,

    grade marketplace.coffee_grade NOT NULL,

    variety VARCHAR(100),

    quantity_kg NUMERIC(8,2) NOT NULL,

    price_per_kg NUMERIC(8,2) NOT NULL,

    harvest_date DATE NOT NULL,

    altitude_m NUMERIC(6,1),

    cup_score NUMERIC(4,1),

    photo_urls TEXT[] NOT NULL DEFAULT '{}',

    status marketplace.listing_status NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_listings_farmer
        FOREIGN KEY (farmer_id)
        REFERENCES marketplace.farmer_profiles(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_listings_region ON marketplace.listings (region);
CREATE INDEX idx_listings_grade ON marketplace.listings (grade);
CREATE INDEX idx_listings_status ON marketplace.listings (status);

COMMENT ON TABLE marketplace.listings IS
'Coffee lot listings published by farmers for buyers to browse and purchase.';

COMMIT;
