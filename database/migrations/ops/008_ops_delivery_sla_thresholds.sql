-- ============================================================================
-- Nahu Platform
-- Migration : ops/008_ops_delivery_sla_thresholds.sql
-- Module    : Ops / Delivery (D9)
-- Description:
--     Configurable age-based SLA windows for delayed delivery monitoring.
--     Count-based alert thresholds remain in ops.alert_thresholds (D1).
-- ============================================================================

BEGIN;

INSERT INTO ops.system_settings (code, display_name, description, value_text)
VALUES
    (
        'delivery.sla.in_transit_hours',
        'In-transit delay SLA (hours)',
        'Shipments in PICKED_UP or IN_TRANSIT older than this (by updated_at) are delayed.',
        '24'
    ),
    (
        'delivery.sla.pod_pending_hours',
        'POD-pending delay SLA (hours)',
        'Shipments in ARRIVED or DELIVERED older than this (by updated_at) are POD-pending delayed.',
        '12'
    )
ON CONFLICT (code) DO NOTHING;

COMMIT;
