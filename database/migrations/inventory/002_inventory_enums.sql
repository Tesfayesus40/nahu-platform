-- ============================================================================
-- Nahu Platform
-- Migration : 002_inventory_enums.sql
-- Module    : Inventory (Phase 4.2)
-- ============================================================================

BEGIN;

CREATE TYPE inventory.lot_status AS ENUM
(
    'RECEIVED',
    'AVAILABLE',
    'RESERVED',
    'QUARANTINE',
    'DAMAGED',
    'EXPIRED',
    'SOLD',
    'DEPLETED',
    'CANCELLED'
);

CREATE TYPE inventory.movement_type AS ENUM
(
    'RECEIVE',
    'ADJUST_IN',
    'ADJUST_OUT',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'RESERVE',
    'RELEASE',
    'DISPATCH',
    'LOSS',
    'RETURN'
);

CREATE TYPE inventory.lot_source_type AS ENUM
(
    'HARVEST',
    'PURCHASE',
    'TRANSFER_IN',
    'ADJUSTMENT_OPENING',
    'OTHER'
);

COMMIT;
