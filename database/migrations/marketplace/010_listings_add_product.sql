-- ============================================================================
-- Nahu Platform
-- Migration : 010_listings_add_product.sql
-- Module    : Marketplace
-- Phase     : 3 — Product Catalog
-- Description:
--     Adds nullable product_id FK on marketplace.listings.
-- ============================================================================

BEGIN;

ALTER TABLE marketplace.listings
    ADD COLUMN IF NOT EXISTS product_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_listings_product'
    ) THEN
        ALTER TABLE marketplace.listings
            ADD CONSTRAINT fk_listings_product
                FOREIGN KEY (product_id)
                REFERENCES catalog.products (id)
                ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_listings_product_id
    ON marketplace.listings (product_id);

COMMENT ON COLUMN marketplace.listings.product_id IS
'References catalog.products — saleable product for this listing. Nullable until backfill verified.';

COMMIT;
