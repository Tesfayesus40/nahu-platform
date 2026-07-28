-- ============================================================================
-- Nahu Platform
-- Migration : ops/013_ops_query_indexes.sql
-- Module    : Ops (G10 / Production Readiness PR-H3)
-- Description:
--     Additive indexes for admin ops filters on escrow, settlement,
--     and stuck-order queries. No data / column changes.
-- ============================================================================

BEGIN;

CREATE INDEX IF NOT EXISTS idx_payment_cases_escrow_status
    ON payments.payment_cases (escrow_status);

CREATE INDEX IF NOT EXISTS idx_payment_cases_settlement_status
    ON payments.payment_cases (settlement_status);

CREATE INDEX IF NOT EXISTS idx_orders_status_updated_at
    ON orders.orders (status, updated_at DESC);

COMMIT;
