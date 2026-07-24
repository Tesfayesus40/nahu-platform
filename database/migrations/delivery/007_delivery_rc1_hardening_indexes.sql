-- ============================================================================
-- Nahu Platform
-- Migration : delivery/007_delivery_rc1_hardening_indexes.sql
-- Module    : Delivery (D12 RC1)
-- Description:
--     RC1 hardening: unique primary accrual per shipment, settlement
--     marker reference uniqueness, hot-path indexes. No behavior change.
-- ============================================================================

BEGIN;

-- One primary delivery earning per shipment (concurrent complete/accrue safe).
CREATE UNIQUE INDEX IF NOT EXISTS uq_shipment_earnings_primary_accrual
  ON delivery.shipment_earnings (shipment_id)
  WHERE replaces_earning_id IS NULL
    AND earning_type IN ('DELIVERY_EARNING', 'DROPOFF_FLAT');

-- Idempotent approve/paid markers share stable references.
CREATE UNIQUE INDEX IF NOT EXISTS uq_shipment_earnings_reference
  ON delivery.shipment_earnings (reference)
  WHERE reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipment_earnings_replaces
  ON delivery.shipment_earnings (replaces_earning_id)
  WHERE replaces_earning_id IS NOT NULL;

-- Stale / SLA filters: status + updated_at
CREATE INDEX IF NOT EXISTS idx_shipments_status_updated
  ON delivery.shipments (current_status, updated_at DESC)
  WHERE deleted_at IS NULL;

-- Pickup-started idempotency lookups
CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment_type
  ON delivery.shipment_events (shipment_id, event_type);

COMMENT ON INDEX delivery.uq_shipment_earnings_primary_accrual IS
  'D12: at most one primary DELIVERY_EARNING/DROPOFF_FLAT per shipment';

COMMIT;
