-- ============================================================================
-- Nahu Platform
-- Migration : 006_inventory_warehouse_fk_relocate.sql
-- Module    : Inventory + Warehouse (Phase 4.3)
-- Description: FK storage_site_id; RELOCATE movement; site columns on movements.
-- Depends on: warehouse/001..005
-- Note: ADD VALUE must run outside a transaction block on some PG versions.
-- ============================================================================

ALTER TYPE inventory.movement_type ADD VALUE 'RELOCATE';

BEGIN;

ALTER TABLE inventory.stock_lots
    ADD CONSTRAINT fk_stock_lots_storage_site
        FOREIGN KEY (storage_site_id)
        REFERENCES warehouse.storage_sites (id)
        ON DELETE SET NULL;

CREATE INDEX idx_stock_lots_storage_site_id
    ON inventory.stock_lots (storage_site_id);

COMMENT ON COLUMN inventory.stock_lots.storage_site_id IS
'Current hold location (warehouse.storage_sites). NULL = location not assigned.';

ALTER TABLE inventory.stock_movements
    ADD COLUMN from_storage_site_id UUID,
    ADD COLUMN to_storage_site_id   UUID;

ALTER TABLE inventory.stock_movements
    ADD CONSTRAINT fk_stock_movements_from_site
        FOREIGN KEY (from_storage_site_id)
        REFERENCES warehouse.storage_sites (id)
        ON DELETE SET NULL;

ALTER TABLE inventory.stock_movements
    ADD CONSTRAINT fk_stock_movements_to_site
        FOREIGN KEY (to_storage_site_id)
        REFERENCES warehouse.storage_sites (id)
        ON DELETE SET NULL;

-- Pure RELOCATE may be qty-neutral (0); other types still use positive qty in app layer.
ALTER TABLE inventory.stock_movements
    DROP CONSTRAINT chk_stock_movements_qty;

ALTER TABLE inventory.stock_movements
    ADD CONSTRAINT chk_stock_movements_qty CHECK (qty >= 0);

COMMIT;
