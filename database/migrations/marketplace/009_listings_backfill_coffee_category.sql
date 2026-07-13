-- ============================================================================
-- Nahu Platform
-- Migration : 009_listings_backfill_coffee_category.sql
-- Module    : Marketplace
-- Phase     : 2 — Nahu Farms generalization
-- Description:
--     Assigns the COFFEE category to every existing listing that does not yet
--     have a category_id. Safe to re-run (only updates NULL rows).
-- ============================================================================

BEGIN;

UPDATE marketplace.listings
SET category_id = (
    SELECT id FROM catalog.categories WHERE code = 'COFFEE' LIMIT 1
)
WHERE category_id IS NULL;

COMMIT;
