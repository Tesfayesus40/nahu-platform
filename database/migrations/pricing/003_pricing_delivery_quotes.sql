-- ============================================================================
-- Nahu Platform
-- Migration : pricing/003_pricing_delivery_quotes.sql
-- Module    : Pricing
-- Description:
--     Delivery quotes bound at checkout (TTL + immutable inputs/outputs).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS pricing.delivery_quotes
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_schedule_id UUID NOT NULL REFERENCES pricing.fee_schedules(id) ON DELETE RESTRICT,
    buyer_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    vehicle_type VARCHAR(40) NOT NULL,
    distance_km NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (distance_km >= 0),
    weight_kg NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (weight_kg >= 0),
    volume_m3 NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (volume_m3 >= 0),
    delivery_fee_etb NUMERIC(12, 2) NOT NULL CHECK (delivery_fee_etb >= 0),
    delivery_commission_etb NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (delivery_commission_etb >= 0),
    courier_payout_etb NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (courier_payout_etb >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'ETB',
    expires_at TIMESTAMPTZ NOT NULL,
    order_id UUID REFERENCES orders.orders(id) ON DELETE SET NULL,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_quotes_buyer
    ON pricing.delivery_quotes (buyer_user_id);

CREATE INDEX IF NOT EXISTS idx_delivery_quotes_expires
    ON pricing.delivery_quotes (expires_at);

CREATE INDEX IF NOT EXISTS idx_delivery_quotes_order
    ON pricing.delivery_quotes (order_id);

COMMIT;
