-- ============================================================================
-- Nahu Platform
-- Migration : 012_listings_unit_and_packaging.sql
-- Module    : Marketplace
-- Phase     : G1 — Marketplace contract generalization
-- Description:
--     Additive unit-aware quantity/price and optional packaging on listings.
--     Backfills from quantity_kg / price_per_kg (unit_code = KG).
--     Safe to re-run (IF NOT EXISTS + backfill only NULL rows).
-- ============================================================================

BEGIN;

ALTER TABLE marketplace.listings
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 3);

ALTER TABLE marketplace.listings
    ADD COLUMN IF NOT EXISTS unit_code VARCHAR(20);

ALTER TABLE marketplace.listings
    ADD COLUMN IF NOT EXISTS price_per_unit NUMERIC(12, 2);

ALTER TABLE marketplace.listings
    ADD COLUMN IF NOT EXISTS packaging_label VARCHAR(100);

ALTER TABLE marketplace.listings
    ADD COLUMN IF NOT EXISTS packaging_quantity NUMERIC(12, 3);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_listings_unit_code'
          AND conrelid = 'marketplace.listings'::regclass
    ) THEN
        ALTER TABLE marketplace.listings
            ADD CONSTRAINT fk_listings_unit_code
            FOREIGN KEY (unit_code)
            REFERENCES catalog.units (code)
            ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_listings_unit_code
    ON marketplace.listings (unit_code);

COMMENT ON COLUMN marketplace.listings.quantity IS
'Canonical offered quantity in unit_code. Dual-written with quantity_kg for coffee/KG legacy clients.';

COMMENT ON COLUMN marketplace.listings.unit_code IS
'Sale unit from catalog.units (KG, LITER, HEAD, PIECE, …).';

COMMENT ON COLUMN marketplace.listings.price_per_unit IS
'Price in ETB per unit_code. Dual-written with price_per_kg when unit is KG.';

COMMENT ON COLUMN marketplace.listings.packaging_label IS
'Optional packaging description (crate, jar, tray, seedling bag, …).';

COMMENT ON COLUMN marketplace.listings.packaging_quantity IS
'Optional count of sale units contained in one packaging unit.';

UPDATE marketplace.listings
SET
    quantity = quantity_kg,
    unit_code = 'KG',
    price_per_unit = price_per_kg
WHERE quantity IS NULL
   OR unit_code IS NULL
   OR price_per_unit IS NULL;

COMMIT;
