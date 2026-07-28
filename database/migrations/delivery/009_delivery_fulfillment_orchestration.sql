-- ============================================================================
-- Nahu Platform
-- Migration : delivery/009_delivery_fulfillment_orchestration.sql
-- Module    : Delivery (G8 Fulfilment Orchestration)
-- Description:
--     Additive orchestration status + confirmation/settlement timestamps
--     on fulfillment_cases; assignment offer expiry for timeout/reassign.
-- ============================================================================

BEGIN;

ALTER TABLE delivery.fulfillment_cases
    ADD COLUMN IF NOT EXISTS orchestration_status VARCHAR(40) NOT NULL DEFAULT 'PLACED',
    ADD COLUMN IF NOT EXISTS seller_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ready_for_pickup_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS courier_assigned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS in_transit_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS seller_pickup_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS courier_pickup_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS buyer_delivery_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS courier_delivery_confirmed_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_fulfillment_orchestration_status'
    ) THEN
        ALTER TABLE delivery.fulfillment_cases
            ADD CONSTRAINT ck_fulfillment_orchestration_status
            CHECK (orchestration_status IN (
                'PLACED',
                'PAID',
                'SELLER_ACCEPTED',
                'PREPARING',
                'READY_FOR_PICKUP',
                'COURIER_ASSIGNED',
                'PICKED_UP',
                'IN_TRANSIT',
                'DELIVERED',
                'SETTLED',
                'CANCELLED',
                'EXCEPTION'
            ));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fulfillment_orchestration_status
    ON delivery.fulfillment_cases (orchestration_status);

COMMENT ON COLUMN delivery.fulfillment_cases.orchestration_status IS
'G8 end-to-end fulfilment orchestration status (additive; OrderStatus remains RC1).';

-- Backfill orchestration from existing order statuses
UPDATE delivery.fulfillment_cases fc
SET orchestration_status = CASE o.status::text
        WHEN 'PENDING_PAYMENT' THEN 'PLACED'
        WHEN 'PAID_ESCROW' THEN 'PAID'
        WHEN 'CONFIRMED' THEN 'SELLER_ACCEPTED'
        WHEN 'SHIPPED' THEN 'IN_TRANSIT'
        WHEN 'DELIVERED' THEN 'DELIVERED'
        WHEN 'COMPLETED' THEN 'SETTLED'
        WHEN 'CANCELLED' THEN 'CANCELLED'
        WHEN 'DISPUTED' THEN 'EXCEPTION'
        ELSE fc.orchestration_status
    END,
    settled_at = CASE WHEN o.status::text = 'COMPLETED' THEN COALESCE(fc.settled_at, NOW()) ELSE fc.settled_at END,
    updated_at = NOW()
FROM orders.orders o
WHERE o.id = fc.order_id;

ALTER TABLE delivery.shipment_assignments
    ADD COLUMN IF NOT EXISTS offer_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shipment_assignments_offer_expires
    ON delivery.shipment_assignments (offer_expires_at)
    WHERE is_active = TRUE AND accepted_at IS NULL AND rejected_at IS NULL;

COMMIT;
