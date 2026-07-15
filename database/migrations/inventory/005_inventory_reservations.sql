-- ============================================================================
-- Nahu Platform
-- Migration : 005_inventory_reservations.sql
-- Module    : Inventory (Phase 4.2)
-- Description: Reservation table for listing/order binds (API in Phase 4.4).
-- ============================================================================

BEGIN;

CREATE TABLE inventory.reservations
(
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    lot_id     UUID NOT NULL,

    listing_id UUID,

    order_id   UUID,

    qty        NUMERIC(14, 3) NOT NULL,

    unit_code  VARCHAR(20) NOT NULL,

    status     VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_reservations_lot
        FOREIGN KEY (lot_id)
        REFERENCES inventory.stock_lots (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_reservations_unit
        FOREIGN KEY (unit_code)
        REFERENCES catalog.units (code)
        ON DELETE RESTRICT,

    CONSTRAINT chk_reservations_qty CHECK (qty > 0)
);

CREATE INDEX idx_reservations_lot_id ON inventory.reservations (lot_id);

COMMENT ON TABLE inventory.reservations IS
'Soft holds of lot qty for listings/orders. Service APIs land in Phase 4.4.';

COMMIT;
