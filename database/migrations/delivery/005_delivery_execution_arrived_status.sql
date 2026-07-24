-- ============================================================================
-- Nahu Platform
-- Migration : delivery/005_delivery_execution_arrived_status.sql
-- Module    : Delivery (D5)
-- Description:
--     Add ARRIVED shipment status + arrived_at for execution engine.
-- ============================================================================

BEGIN;

ALTER TABLE delivery.shipments
  DROP CONSTRAINT IF EXISTS shipments_current_status_check;

ALTER TABLE delivery.shipments
  ADD CONSTRAINT shipments_current_status_check
  CHECK (current_status IN (
      'CREATED',
      'AWAITING_ASSIGNMENT',
      'ASSIGNED',
      'ACCEPTED',
      'PICKED_UP',
      'IN_TRANSIT',
      'ARRIVED',
      'DELIVERED',
      'BUYER_CONFIRMED',
      'COMPLETED',
      'CANCELLED',
      'RETURNED',
      'FAILED'
  ));

ALTER TABLE delivery.shipments
  ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;

-- Refresh one-active-outbound index to include ARRIVED
DROP INDEX IF EXISTS delivery.uq_shipments_one_active_outbound;

CREATE UNIQUE INDEX uq_shipments_one_active_outbound
    ON delivery.shipments (fulfillment_id)
    WHERE deleted_at IS NULL
      AND shipment_type = 'OUTBOUND'
      AND current_status IN (
          'CREATED',
          'AWAITING_ASSIGNMENT',
          'ASSIGNED',
          'ACCEPTED',
          'PICKED_UP',
          'IN_TRANSIT',
          'ARRIVED',
          'DELIVERED',
          'BUYER_CONFIRMED'
      );

COMMIT;
