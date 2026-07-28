-- ============================================================================
-- Nahu Platform
-- Migration : pricing/004_pricing_payment_rail_stubs.sql
-- Module    : Pricing
-- Description:
--     Phase 5 — payment capture / disbursement intent ledger (no live provider).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS pricing.payment_intents
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders.orders(id) ON DELETE RESTRICT,
    provider_code VARCHAR(40) NOT NULL,
    intent_type VARCHAR(40) NOT NULL
        CHECK (intent_type IN (
            'BUYER_CAPTURE',
            'FARMER_DISBURSEMENT',
            'COURIER_DISBURSEMENT',
            'BUYER_REFUND'
        )),
    amount_etb NUMERIC(12, 2) NOT NULL CHECK (amount_etb >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'ETB',
    status VARCHAR(40) NOT NULL DEFAULT 'RECORDED_PENDING_PROVIDER'
        CHECK (status IN (
            'RECORDED_PENDING_PROVIDER',
            'SUBMITTED',
            'SUCCEEDED',
            'FAILED',
            'CANCELLED'
        )),
    external_reference VARCHAR(120),
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_order
    ON pricing.payment_intents (order_id);

CREATE INDEX IF NOT EXISTS idx_payment_intents_type_status
    ON pricing.payment_intents (intent_type, status);

COMMIT;
