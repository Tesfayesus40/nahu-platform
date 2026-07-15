-- ============================================================================
-- Nahu Platform
-- Migration : 007_inventory_reservations_listing_bind.sql
-- Module    : Inventory + Marketplace (Phase 4.4)
-- Description: Extensible reservation statuses, FKs/indexes; listing stock/farm cols.
-- ============================================================================

-- Status enum includes Phase 5 placeholders (ALLOCATED, DISPATCHED) to avoid redesign.
CREATE TYPE inventory.reservation_status AS ENUM
(
    'ACTIVE',
    'ORDER_HELD',
    'RELEASED',
    'CONSUMED',
    'ALLOCATED',
    'DISPATCHED'
);

BEGIN;

ALTER TABLE inventory.reservations
    ALTER COLUMN status DROP DEFAULT;

ALTER TABLE inventory.reservations
    ALTER COLUMN status TYPE inventory.reservation_status
    USING (
        CASE upper(status)
            WHEN 'ACTIVE' THEN 'ACTIVE'::inventory.reservation_status
            WHEN 'ORDER_HELD' THEN 'ORDER_HELD'::inventory.reservation_status
            WHEN 'RELEASED' THEN 'RELEASED'::inventory.reservation_status
            WHEN 'CONSUMED' THEN 'CONSUMED'::inventory.reservation_status
            WHEN 'ALLOCATED' THEN 'ALLOCATED'::inventory.reservation_status
            WHEN 'DISPATCHED' THEN 'DISPATCHED'::inventory.reservation_status
            ELSE 'ACTIVE'::inventory.reservation_status
        END
    );

ALTER TABLE inventory.reservations
    ALTER COLUMN status SET DEFAULT 'ACTIVE'::inventory.reservation_status;

ALTER TABLE inventory.reservations
    ADD CONSTRAINT fk_reservations_listing
        FOREIGN KEY (listing_id)
        REFERENCES marketplace.listings (id)
        ON DELETE SET NULL;

ALTER TABLE inventory.reservations
    ADD CONSTRAINT fk_reservations_order
        FOREIGN KEY (order_id)
        REFERENCES orders.orders (id)
        ON DELETE SET NULL;

CREATE INDEX idx_reservations_listing_id ON inventory.reservations (listing_id);

CREATE INDEX idx_reservations_order_id ON inventory.reservations (order_id);

CREATE UNIQUE INDEX uq_reservations_one_active_listing
    ON inventory.reservations (listing_id)
    WHERE status = 'ACTIVE' AND listing_id IS NOT NULL;

COMMENT ON TYPE inventory.reservation_status IS
'Soft-hold lifecycle. ALLOCATED/DISPATCHED reserved for Phase 5 fulfillment; unused by 4.4 APIs.';

COMMENT ON COLUMN inventory.reservations.status IS
'ACTIVE=listing hold; ORDER_HELD=order hold (Option B); RELEASED/CONSUMED terminal; ALLOCATED/DISPATCHED future.';

ALTER TABLE marketplace.listings
    ADD COLUMN IF NOT EXISTS stock_lot_id UUID,
    ADD COLUMN IF NOT EXISTS farm_id UUID;

ALTER TABLE marketplace.listings
    ADD CONSTRAINT fk_listings_stock_lot
        FOREIGN KEY (stock_lot_id)
        REFERENCES inventory.stock_lots (id)
        ON DELETE SET NULL;

ALTER TABLE marketplace.listings
    ADD CONSTRAINT fk_listings_farm
        FOREIGN KEY (farm_id)
        REFERENCES farms.farms (id)
        ON DELETE SET NULL;

CREATE INDEX idx_listings_stock_lot_id ON marketplace.listings (stock_lot_id);

CREATE INDEX idx_listings_farm_id ON marketplace.listings (farm_id);

COMMENT ON COLUMN marketplace.listings.stock_lot_id IS
'Optional denormalized lot bind. Authoritative hold is inventory.reservations.';

COMMENT ON COLUMN marketplace.listings.farm_id IS
'Optional farm context for filters/analytics; nullable for offer-only listings.';

COMMIT;
