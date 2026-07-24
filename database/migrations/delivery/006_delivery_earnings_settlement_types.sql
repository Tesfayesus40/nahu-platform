-- ============================================================================
-- Nahu Platform
-- Migration : delivery/006_delivery_earnings_settlement_types.sql
-- Module    : Delivery (D11)
-- Description:
--     Extend shipment_earnings earning_type + ledger_status for settlement
--     engine (DELIVERY_EARNING, REVERSAL, PENALTY; ELIGIBLE/APPROVED/REVERSED…).
--     Append-only immutability unchanged (004 guards).
-- ============================================================================

BEGIN;

ALTER TABLE delivery.shipment_earnings
  DROP CONSTRAINT IF EXISTS shipment_earnings_earning_type_check;

ALTER TABLE delivery.shipment_earnings
  ADD CONSTRAINT shipment_earnings_earning_type_check
  CHECK (earning_type IN (
      'DROPOFF_FLAT',
      'PICKUP_FEE',
      'DISTANCE',
      'BONUS',
      'ADJUSTMENT',
      'VOID',
      'OTHER',
      'DELIVERY_EARNING',
      'REVERSAL',
      'PENALTY'
  ));

ALTER TABLE delivery.shipment_earnings
  DROP CONSTRAINT IF EXISTS shipment_earnings_ledger_status_check;

ALTER TABLE delivery.shipment_earnings
  ADD CONSTRAINT shipment_earnings_ledger_status_check
  CHECK (ledger_status IN (
      'ACCRUED',
      'ADJUSTED',
      'PAID',
      'VOID',
      'PENDING',
      'ELIGIBLE',
      'APPROVED',
      'REVERSED'
  ));

COMMENT ON COLUMN delivery.shipment_earnings.ledger_status IS
  'Settlement lifecycle on append-only rows: ELIGIBLE→APPROVED→PAID; REVERSED/VOID via new rows.';

COMMIT;
