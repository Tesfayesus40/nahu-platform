-- ============================================================================
-- Nahu Platform
-- Migration : 008_inventory_cropping_cycle_fk.sql
-- Module    : Inventory (Phase 4.5 bridge)
-- Description: Optional cropping cycle / line FKs on stock lots for harvest attribution.
-- ============================================================================

BEGIN;

ALTER TABLE inventory.stock_lots
    ADD COLUMN IF NOT EXISTS cropping_cycle_id UUID,
    ADD COLUMN IF NOT EXISTS cropping_cycle_line_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_stock_lots_cropping_cycle'
    ) THEN
        ALTER TABLE inventory.stock_lots
            ADD CONSTRAINT fk_stock_lots_cropping_cycle
            FOREIGN KEY (cropping_cycle_id)
            REFERENCES farms.cropping_cycles (id)
            ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_stock_lots_cropping_cycle_line'
    ) THEN
        ALTER TABLE inventory.stock_lots
            ADD CONSTRAINT fk_stock_lots_cropping_cycle_line
            FOREIGN KEY (cropping_cycle_line_id)
            REFERENCES farms.cropping_cycle_lines (id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_lots_cropping_cycle_id
    ON inventory.stock_lots (cropping_cycle_id);

CREATE INDEX IF NOT EXISTS idx_stock_lots_cropping_cycle_line_id
    ON inventory.stock_lots (cropping_cycle_line_id);

COMMENT ON COLUMN inventory.stock_lots.cropping_cycle_id IS
'Optional explicit bind of harvest lot to a production plan (cropping cycle).';

COMMENT ON COLUMN inventory.stock_lots.cropping_cycle_line_id IS
'Optional explicit bind of harvest lot to a cycle product line. Multiple lots may share one line.';

COMMIT;
