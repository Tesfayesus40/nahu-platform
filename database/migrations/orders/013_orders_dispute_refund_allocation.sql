-- ============================================================================
-- Nahu Platform
-- Migration : orders/013_orders_dispute_refund_allocation.sql
-- Module    : Orders
-- Description:
--     Multi-stream refund allocation on dispute cases (intent only).
-- ============================================================================

BEGIN;

ALTER TABLE orders.dispute_cases
    ADD COLUMN IF NOT EXISTS refund_goods_etb NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS refund_buyer_fee_etb NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS refund_delivery_etb NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS refund_policy_code VARCHAR(80);

COMMENT ON COLUMN orders.dispute_cases.refund_goods_etb IS
'Refund allocation toward goods subtotal (intent).';
COMMENT ON COLUMN orders.dispute_cases.refund_buyer_fee_etb IS
'Refund allocation toward buyer platform fee (intent).';
COMMENT ON COLUMN orders.dispute_cases.refund_delivery_etb IS
'Refund allocation toward delivery fee (intent).';

COMMIT;
