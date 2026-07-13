-- ============================================================================
-- Nahu Platform
-- Migration : 008_listings_add_category.sql
-- Module    : Marketplace
-- Phase     : 2 — Nahu Farms generalization
-- Description:
--     Adds a nullable category_id FK on marketplace.listings so each listing
--     can be associated with an agricultural product category. category_id stays
--     nullable until Phase 2 is verified on staging — NOT NULL is deferred.
-- ============================================================================

BEGIN;

ALTER TABLE marketplace.listings
    ADD COLUMN IF NOT EXISTS category_id UUID;

ALTER TABLE marketplace.listings
    ADD CONSTRAINT fk_listings_category
        FOREIGN KEY (category_id)
        REFERENCES catalog.categories(id)
        ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_listings_category_id ON marketplace.listings (category_id);

COMMENT ON COLUMN marketplace.listings.category_id IS
'References catalog.categories — COFFEE for all existing coffee listings. Nullable until backfill and staging verification complete.';

COMMIT;
