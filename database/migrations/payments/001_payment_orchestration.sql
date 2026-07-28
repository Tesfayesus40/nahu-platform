-- ============================================================================
-- Nahu Platform
-- Migration : payments/001_payment_orchestration.sql
-- Module    : Payments (G9 Payment & Settlement Orchestration)
-- Description:
--     Additive payment cases, escrow ledger, settlement lines, and
--     payment event audit trail. Does not change orders.orders RC1 status.
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS payments;

CREATE TABLE IF NOT EXISTS payments.payment_cases
(
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                UUID NOT NULL UNIQUE
        REFERENCES orders.orders (id) ON DELETE RESTRICT,
    provider_code           VARCHAR(40) NOT NULL,
    payment_status          VARCHAR(40) NOT NULL DEFAULT 'CREATED',
    escrow_status           VARCHAR(40) NOT NULL DEFAULT 'NONE',
    settlement_status       VARCHAR(40) NOT NULL DEFAULT 'NOT_STARTED',
    refund_status           VARCHAR(40) NOT NULL DEFAULT 'NONE',
    currency                VARCHAR(3)  NOT NULL DEFAULT 'ETB',
    amount_etb              NUMERIC(12, 2) NOT NULL DEFAULT 0,
    goods_subtotal_etb      NUMERIC(12, 2) NOT NULL DEFAULT 0,
    buyer_fee_etb           NUMERIC(12, 2) NOT NULL DEFAULT 0,
    farmer_fee_etb          NUMERIC(12, 2) NOT NULL DEFAULT 0,
    farmer_payout_etb       NUMERIC(12, 2) NOT NULL DEFAULT 0,
    delivery_fee_etb        NUMERIC(12, 2) NOT NULL DEFAULT 0,
    delivery_commission_etb NUMERIC(12, 2) NOT NULL DEFAULT 0,
    courier_payout_etb      NUMERIC(12, 2) NOT NULL DEFAULT 0,
    platform_revenue_etb    NUMERIC(12, 2) NOT NULL DEFAULT 0,
    escrow_held_etb         NUMERIC(12, 2) NOT NULL DEFAULT 0,
    escrow_released_etb     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    escrow_refunded_etb     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    external_reference      VARCHAR(120),
    pending_at              TIMESTAMPTZ,
    authorized_at           TIMESTAMPTZ,
    captured_at             TIMESTAMPTZ,
    escrowed_at             TIMESTAMPTZ,
    settled_at              TIMESTAMPTZ,
    refunded_at             TIMESTAMPTZ,
    failed_at               TIMESTAMPTZ,
    cancelled_at            TIMESTAMPTZ,
    failure_reason          TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_payment_status CHECK (payment_status IN (
        'CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'ESCROWED',
        'PARTIALLY_SETTLED', 'SETTLED', 'REFUNDED', 'FAILED', 'CANCELLED'
    )),
    CONSTRAINT ck_escrow_status CHECK (escrow_status IN (
        'NONE', 'HELD', 'PARTIALLY_RELEASED', 'RELEASED', 'REFUNDED'
    )),
    CONSTRAINT ck_settlement_status CHECK (settlement_status IN (
        'NOT_STARTED', 'IN_PROGRESS', 'PARTIAL', 'COMPLETED'
    )),
    CONSTRAINT ck_refund_status CHECK (refund_status IN (
        'NONE', 'REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_payment_cases_status
    ON payments.payment_cases (payment_status);

CREATE INDEX IF NOT EXISTS idx_payment_cases_provider
    ON payments.payment_cases (provider_code);

CREATE TABLE IF NOT EXISTS payments.payment_events
(
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_case_id UUID NOT NULL
        REFERENCES payments.payment_cases (id) ON DELETE CASCADE,
    event_type      VARCHAR(60) NOT NULL,
    from_status     VARCHAR(40),
    to_status       VARCHAR(40),
    actor_user_id   UUID,
    reason          TEXT,
    message         TEXT,
    metadata_json   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_case
    ON payments.payment_events (payment_case_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payments.escrow_ledger
(
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_case_id UUID NOT NULL
        REFERENCES payments.payment_cases (id) ON DELETE CASCADE,
    entry_type      VARCHAR(40) NOT NULL,
    amount_etb      NUMERIC(12, 2) NOT NULL,
    party_code      VARCHAR(40),
    actor_user_id   UUID,
    reason          TEXT,
    metadata_json   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_escrow_entry_type CHECK (entry_type IN (
        'HOLD', 'RELEASE', 'PARTIAL_RELEASE', 'REFUND'
    )),
    CONSTRAINT ck_escrow_amount_positive CHECK (amount_etb > 0)
);

CREATE INDEX IF NOT EXISTS idx_escrow_ledger_case
    ON payments.escrow_ledger (payment_case_id, created_at ASC);

CREATE TABLE IF NOT EXISTS payments.settlement_lines
(
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_case_id UUID NOT NULL
        REFERENCES payments.payment_cases (id) ON DELETE CASCADE,
    party_code      VARCHAR(40) NOT NULL,
    amount_etb      NUMERIC(12, 2) NOT NULL,
    status          VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    intent_id       UUID,
    released_at     TIMESTAMPTZ,
    metadata_json   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_settlement_party CHECK (party_code IN (
        'FARMER', 'COURIER', 'PLATFORM'
    )),
    CONSTRAINT ck_settlement_line_status CHECK (status IN (
        'PENDING', 'RELEASED', 'FAILED', 'SKIPPED'
    )),
    CONSTRAINT ck_settlement_line_amount CHECK (amount_etb >= 0)
);

CREATE INDEX IF NOT EXISTS idx_settlement_lines_case
    ON payments.settlement_lines (payment_case_id);

COMMENT ON TABLE payments.payment_cases IS
'G9 payment orchestration case (1:1 order). Additive to RC1 OrderStatus.';

-- Backfill from existing orders (best-effort)
INSERT INTO payments.payment_cases (
    order_id, provider_code, payment_status, escrow_status, settlement_status,
    refund_status, amount_etb, goods_subtotal_etb, buyer_fee_etb, farmer_fee_etb,
    farmer_payout_etb, delivery_fee_etb, delivery_commission_etb, courier_payout_etb,
    platform_revenue_etb, escrow_held_etb, escrow_released_etb, escrowed_at,
    settled_at, pending_at, external_reference, created_at, updated_at
)
SELECT
    o.id,
    o.payment_method::text,
    CASE o.status::text
        WHEN 'PENDING_PAYMENT' THEN 'PENDING'
        WHEN 'PAID_ESCROW' THEN 'ESCROWED'
        WHEN 'CONFIRMED' THEN 'ESCROWED'
        WHEN 'SHIPPED' THEN 'ESCROWED'
        WHEN 'DELIVERED' THEN 'ESCROWED'
        WHEN 'COMPLETED' THEN 'SETTLED'
        WHEN 'CANCELLED' THEN 'CANCELLED'
        WHEN 'DISPUTED' THEN 'ESCROWED'
        ELSE 'CREATED'
    END,
    CASE
        WHEN o.status::text IN ('PAID_ESCROW', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'DISPUTED')
            THEN 'HELD'
        WHEN o.status::text = 'COMPLETED' THEN 'RELEASED'
        ELSE 'NONE'
    END,
    CASE WHEN o.status::text = 'COMPLETED' THEN 'COMPLETED' ELSE 'NOT_STARTED' END,
    'NONE',
    COALESCE(o.buyer_charge_etb, o.total_etb, 0),
    COALESCE(o.goods_subtotal_etb, o.total_etb, 0),
    COALESCE(o.buyer_fee_etb, 0),
    COALESCE(o.farmer_fee_etb, o.commission_etb, 0),
    COALESCE(o.farmer_payout_etb, 0),
    COALESCE(o.delivery_fee_etb, 0),
    COALESCE(o.delivery_commission_etb, 0),
    COALESCE(o.courier_payout_etb, 0),
    COALESCE(o.buyer_fee_etb, 0) + COALESCE(o.farmer_fee_etb, o.commission_etb, 0)
        + COALESCE(o.delivery_commission_etb, 0),
    CASE
        WHEN o.status::text IN ('PAID_ESCROW', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'DISPUTED')
            THEN COALESCE(o.buyer_charge_etb, o.total_etb, 0)
        ELSE 0
    END,
    CASE WHEN o.status::text = 'COMPLETED'
        THEN COALESCE(o.buyer_charge_etb, o.total_etb, 0) ELSE 0 END,
    o.paid_at,
    o.completed_at,
    CASE WHEN o.status::text = 'PENDING_PAYMENT' THEN o.created_at ELSE NULL END,
    o.payment_reference,
    o.created_at,
    o.updated_at
FROM orders.orders o
ON CONFLICT (order_id) DO NOTHING;

COMMIT;
