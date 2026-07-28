-- ============================================================================
-- Nahu Platform
-- Migration : orders/012_orders_revenue_fee_snapshots.sql
-- Module    : Orders
-- Description:
--     Snapshot platform/delivery fee columns on orders for the revenue engine.
--     commission_etb remains dual-written as farmer platform fee for legacy clients.
-- ============================================================================

BEGIN;

ALTER TABLE orders.orders
    ADD COLUMN IF NOT EXISTS goods_subtotal_etb NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS buyer_fee_etb NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS farmer_fee_etb NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS delivery_fee_etb NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS delivery_commission_etb NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS courier_payout_etb NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS buyer_charge_etb NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS fee_schedule_id UUID,
    ADD COLUMN IF NOT EXISTS delivery_quote_id UUID;

-- Backfill goods_subtotal / farmer_fee / buyer_charge from legacy columns.
UPDATE orders.orders
SET
    goods_subtotal_etb = COALESCE(goods_subtotal_etb, total_etb),
    farmer_fee_etb = COALESCE(farmer_fee_etb, commission_etb),
    buyer_charge_etb = COALESCE(buyer_charge_etb, total_etb)
WHERE goods_subtotal_etb IS NULL
   OR farmer_fee_etb IS NULL
   OR buyer_charge_etb IS NULL;

ALTER TABLE orders.orders
    ALTER COLUMN goods_subtotal_etb SET DEFAULT 0,
    ALTER COLUMN farmer_fee_etb SET DEFAULT 0;

COMMENT ON COLUMN orders.orders.goods_subtotal_etb IS
'Listing goods amount (price × qty) before platform fees / delivery.';
COMMENT ON COLUMN orders.orders.buyer_fee_etb IS
'Buyer platform fee snapshotted at order create.';
COMMENT ON COLUMN orders.orders.farmer_fee_etb IS
'Farmer platform fee snapshotted at order create (also stored in commission_etb).';
COMMENT ON COLUMN orders.orders.buyer_charge_etb IS
'Amount the buyer pays: goods + buyer fee + delivery fee.';
COMMENT ON COLUMN orders.orders.commission_etb IS
'Legacy alias of farmer platform fee; kept for existing mobile/admin clients.';

COMMIT;
