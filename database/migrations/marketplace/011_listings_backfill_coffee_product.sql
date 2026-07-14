-- ============================================================================
-- Nahu Platform
-- Migration : 011_listings_backfill_coffee_product.sql
-- Module    : Marketplace
-- Phase     : 3 — Product Catalog
-- Description:
--     Backfills product_id to ETHIOPIAN_ARABICA_COFFEE for coffee listings.
--     Safe to re-run (only updates NULL product_id rows).
-- ============================================================================

BEGIN;

UPDATE marketplace.listings
SET product_id = (
    SELECT id FROM catalog.products WHERE code = 'ETHIOPIAN_ARABICA_COFFEE'
)
WHERE product_id IS NULL
  AND (
    category_id = (SELECT id FROM catalog.categories WHERE code = 'COFFEE')
    OR category_id IS NULL
  );

COMMIT;
