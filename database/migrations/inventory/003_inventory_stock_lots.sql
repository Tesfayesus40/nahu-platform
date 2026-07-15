-- ============================================================================
-- Nahu Platform
-- Migration : 003_inventory_stock_lots.sql
-- Module    : Inventory (Phase 4.2)
-- ============================================================================

BEGIN;

CREATE TABLE inventory.stock_lots
(
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    lot_code           VARCHAR(64) NOT NULL,

    product_id         UUID NOT NULL,

    product_variety_id UUID,

    farm_id            UUID NOT NULL,

    plot_id            UUID,

    storage_site_id    UUID,

    storage_label      VARCHAR(150),

    unit_code          VARCHAR(20) NOT NULL,

    quantity_on_hand   NUMERIC(14, 3) NOT NULL DEFAULT 0,

    quantity_reserved  NUMERIC(14, 3) NOT NULL DEFAULT 0,

    status             inventory.lot_status NOT NULL DEFAULT 'AVAILABLE',

    source_type        inventory.lot_source_type NOT NULL DEFAULT 'HARVEST',

    harvest_date       DATE,

    received_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_on         DATE,

    quality_note       TEXT,

    external_ref       VARCHAR(100),

    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_stock_lots_product
        FOREIGN KEY (product_id)
        REFERENCES catalog.products (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_stock_lots_variety
        FOREIGN KEY (product_variety_id)
        REFERENCES catalog.product_varieties (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_stock_lots_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms.farms (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_stock_lots_plot
        FOREIGN KEY (plot_id)
        REFERENCES farms.plots (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_stock_lots_unit
        FOREIGN KEY (unit_code)
        REFERENCES catalog.units (code)
        ON DELETE RESTRICT,

    CONSTRAINT chk_stock_lots_qty CHECK (quantity_on_hand >= 0),

    CONSTRAINT chk_stock_lots_reserved CHECK (quantity_reserved >= 0),

    CONSTRAINT chk_stock_lots_reserved_lte_on_hand
        CHECK (quantity_reserved <= quantity_on_hand),

    CONSTRAINT uq_stock_lots_farm_lot_code UNIQUE (farm_id, lot_code)
);

CREATE INDEX idx_stock_lots_farm_id ON inventory.stock_lots (farm_id);

CREATE INDEX idx_stock_lots_product_id ON inventory.stock_lots (product_id);

CREATE INDEX idx_stock_lots_status ON inventory.stock_lots (status);

COMMENT ON TABLE inventory.stock_lots IS
'Traceable batches of a catalog product held at a farm. Farms do not own products.';

COMMENT ON COLUMN inventory.stock_lots.storage_site_id IS
'Reserved for warehouse.storage_sites FK in Phase 4.3.';

COMMIT;
