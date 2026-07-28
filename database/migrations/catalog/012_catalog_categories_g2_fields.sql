-- ============================================================================
-- Nahu Platform
-- Migration : catalog/012_catalog_categories_g2_fields.sql
-- Module    : Catalog (G2 Marketplace Engine)
-- Description:
--     Attaches categories to marketplace_verticals; adds sell_enabled and
--     listing_kind. Backfills all existing categories to AGRICULTURE.
--     RC1 coffee remains active + sell_enabled. Display names normalized
--     (Oil Crops). Additive only — no coffee listing breakage.
-- ============================================================================

BEGIN;

ALTER TABLE catalog.categories
    ADD COLUMN IF NOT EXISTS marketplace_vertical_id UUID,
    ADD COLUMN IF NOT EXISTS sell_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS listing_kind VARCHAR(20) NOT NULL DEFAULT 'GOODS';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_categories_marketplace_vertical'
    ) THEN
        ALTER TABLE catalog.categories
            ADD CONSTRAINT fk_categories_marketplace_vertical
            FOREIGN KEY (marketplace_vertical_id)
            REFERENCES catalog.marketplace_verticals (id)
            ON DELETE RESTRICT;
    END IF;
END $$;

UPDATE catalog.categories c
SET marketplace_vertical_id = v.id
FROM catalog.marketplace_verticals v
WHERE v.code = 'AGRICULTURE'
  AND c.marketplace_vertical_id IS NULL;

-- Coffee (and any already-active category): sellable when active
UPDATE catalog.categories
SET sell_enabled = TRUE,
    listing_kind = 'GOODS',
    updated_at = NOW()
WHERE is_active = TRUE
  AND sell_enabled = FALSE;

UPDATE catalog.categories
SET listing_kind = 'GOODS',
    updated_at = NOW()
WHERE listing_kind IS NULL OR listing_kind = '';

-- Prefer "Oil Crops" display (code remains OILSEEDS for API stability)
UPDATE catalog.categories
SET name_en = 'Oil Crops',
    updated_at = NOW()
WHERE code = 'OILSEEDS'
  AND name_en IS DISTINCT FROM 'Oil Crops';

ALTER TABLE catalog.categories
    ALTER COLUMN marketplace_vertical_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_categories_listing_kind'
    ) THEN
        ALTER TABLE catalog.categories
            ADD CONSTRAINT ck_categories_listing_kind
            CHECK (listing_kind IN ('GOODS', 'SUPPLIES', 'SERVICE'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_marketplace_vertical_id
    ON catalog.categories (marketplace_vertical_id);

CREATE INDEX IF NOT EXISTS idx_categories_sell_enabled
    ON catalog.categories (sell_enabled);

COMMENT ON COLUMN catalog.categories.marketplace_vertical_id IS
'Owning marketplace vertical (G2). All RC1 categories backfilled to AGRICULTURE.';

COMMENT ON COLUMN catalog.categories.sell_enabled IS
'When true with is_active, products in this category may be sold. Independent of vertical.is_active.';

COMMENT ON COLUMN catalog.categories.listing_kind IS
'Canonical listing kind: GOODS | SUPPLIES | SERVICE (agri UI may alias Produce/Inputs/Services).';

COMMIT;
