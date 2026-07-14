-- ============================================================================
-- Nahu Platform
-- Migration : 004_inventory_stock_movements.sql
-- Module    : Inventory (Phase 4.2)
-- Description: Append-only stock ledger.
-- ============================================================================

BEGIN;

CREATE TABLE inventory.stock_movements
(
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    lot_id                  UUID NOT NULL,

    movement_type           inventory.movement_type NOT NULL,

    qty                     NUMERIC(14, 3) NOT NULL,

    unit_code               VARCHAR(20) NOT NULL,

    qty_in_lot_unit         NUMERIC(14, 3) NOT NULL,

    reason                  VARCHAR(500),

    actor_user_id           UUID,

    listing_id              UUID,

    order_id                UUID,

    counterpart_movement_id UUID,

    metadata                JSONB,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_stock_movements_lot
        FOREIGN KEY (lot_id)
        REFERENCES inventory.stock_lots (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_stock_movements_unit
        FOREIGN KEY (unit_code)
        REFERENCES catalog.units (code)
        ON DELETE RESTRICT,

    CONSTRAINT fk_stock_movements_counterpart
        FOREIGN KEY (counterpart_movement_id)
        REFERENCES inventory.stock_movements (id)
        ON DELETE SET NULL,

    CONSTRAINT chk_stock_movements_qty CHECK (qty > 0)
);

CREATE INDEX idx_stock_movements_lot_id ON inventory.stock_movements (lot_id);

CREATE INDEX idx_stock_movements_created_at ON inventory.stock_movements (created_at);

COMMENT ON TABLE inventory.stock_movements IS
'Immutable inventory events. Corrections use compensating movements, never UPDATE.';

COMMIT;
