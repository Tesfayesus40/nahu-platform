-- ============================================================================
-- Nahu Platform
-- Migration : delivery/004_delivery_aggregate_guards.sql
-- Module    : Delivery (D2 refinements — pre-D3)
-- Description:
--     Protect immutable shipment_events / shipment_earnings (INSERT-only).
--     Tighten active assignment integrity.
--     Document ShipmentEvent as canonical analytics/notification source.
-- ============================================================================

BEGIN;

-- Assignment: active rows must not be rejected/cancelled; inactive may carry history stamps.
ALTER TABLE delivery.shipment_assignments
  DROP CONSTRAINT IF EXISTS chk_shipment_assignments_active_integrity;

ALTER TABLE delivery.shipment_assignments
  ADD CONSTRAINT chk_shipment_assignments_active_integrity
  CHECK (
    (
      is_active = TRUE
      AND cancelled_at IS NULL
      AND rejected_at IS NULL
    )
    OR is_active = FALSE
  );

-- Reaffirm: at most one active assignment per shipment (created in 003; ensure present).
CREATE UNIQUE INDEX IF NOT EXISTS uq_shipment_assignments_one_active
  ON delivery.shipment_assignments (shipment_id)
  WHERE is_active = TRUE
    AND cancelled_at IS NULL
    AND rejected_at IS NULL;

-- ---------------------------------------------------------------------------
-- Immutable tables: block UPDATE / DELETE (admin correction = new INSERT rows)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION delivery.reject_immutable_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'delivery.% is append-only; UPDATE/DELETE are not allowed (use compensating INSERT)',
    TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_shipment_events_immutable ON delivery.shipment_events;
CREATE TRIGGER trg_shipment_events_immutable
  BEFORE UPDATE OR DELETE ON delivery.shipment_events
  FOR EACH ROW
  EXECUTE PROCEDURE delivery.reject_immutable_mutation();

DROP TRIGGER IF EXISTS trg_shipment_earnings_immutable ON delivery.shipment_earnings;
CREATE TRIGGER trg_shipment_earnings_immutable
  BEFORE UPDATE OR DELETE ON delivery.shipment_earnings
  FOR EACH ROW
  EXECUTE PROCEDURE delivery.reject_immutable_mutation();

-- ---------------------------------------------------------------------------
-- Canonical event bus (consumers in later milestones — do not fork)
-- ---------------------------------------------------------------------------
COMMENT ON TABLE delivery.shipment_events IS
  'Canonical delivery domain event stream (D2+/RF-3/RF-8). '
  'Intended consumers: notifications, analytics, ETA prediction, AI optimization, '
  'operational dashboards, audit enrichment. '
  'TODO(D4+): publish via DeliveryEventsPublisher; do not create competing event tables. '
  'Append-only: every shipment.current_status change must INSERT exactly one status event.';

COMMENT ON TABLE delivery.shipment_earnings IS
  'Append-only courier earnings ledger (RF-7). Corrections = new rows with replaces_earning_id. '
  'Never UPDATE amount in place.';

COMMENT ON TABLE delivery.shipments IS
  'Shipment aggregate root. Stops, assignments, events, PODs, and earnings must be '
  'written only through shipment domain / aggregate services — not ad-hoc table updates.';

COMMENT ON COLUMN delivery.shipments.current_status IS
  'Latest projection only. Every transition must append delivery.shipment_events '
  '(exactly one status event per transition).';

COMMIT;
