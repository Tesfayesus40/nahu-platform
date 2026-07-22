-- ============================================================================
-- Nahu Platform
-- Migration : delivery/002_delivery_fulfillment_cases.sql
-- Module    : Delivery
-- Description:
--     Thin fulfillment handoff cases linked 1:1 to orders.
--     Extension columns (carrier_code, tracking_ref) support future TMS
--     without requiring a rewrite of Admin Portal contracts.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS delivery.fulfillment_cases
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders.orders(id) ON DELETE RESTRICT,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_HANDOFF'
        CHECK (status IN (
            'PENDING_HANDOFF',
            'READY',
            'IN_TRANSIT',
            'DELIVERED',
            'EXCEPTION',
            'CLOSED'
        )),
    assigned_to_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    carrier_code VARCHAR(50),
    tracking_ref VARCHAR(100),
    pickup_notes TEXT,
    delivery_notes TEXT,
    exception_code VARCHAR(50),
    exception_notes TEXT,
    ready_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fulfillment_cases_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_fulfillment_cases_status
    ON delivery.fulfillment_cases (status);

CREATE INDEX IF NOT EXISTS idx_fulfillment_cases_assigned
    ON delivery.fulfillment_cases (assigned_to_user_id);

CREATE TABLE IF NOT EXISTS delivery.fulfillment_events
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fulfillment_id UUID NOT NULL REFERENCES delivery.fulfillment_cases(id) ON DELETE CASCADE,
    event_type VARCHAR(40) NOT NULL,
    from_status VARCHAR(30),
    to_status VARCHAR(30),
    message TEXT,
    actor_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fulfillment_events_case
    ON delivery.fulfillment_events (fulfillment_id, created_at DESC);

-- Backfill handoff cases for orders already past unpaid states.
INSERT INTO delivery.fulfillment_cases (order_id, status, created_at, updated_at)
SELECT
    o.id,
    CASE
        WHEN o.status IN ('SHIPPED') THEN 'IN_TRANSIT'
        WHEN o.status IN ('DELIVERED', 'COMPLETED') THEN 'DELIVERED'
        WHEN o.status IN ('PAID_ESCROW', 'CONFIRMED') THEN 'READY'
        WHEN o.status = 'CANCELLED' THEN 'CLOSED'
        WHEN o.status = 'DISPUTED' THEN 'EXCEPTION'
        ELSE 'PENDING_HANDOFF'
    END,
    o.created_at,
    o.updated_at
FROM orders.orders o
WHERE o.status <> 'PENDING_PAYMENT'
ON CONFLICT (order_id) DO NOTHING;

COMMIT;
