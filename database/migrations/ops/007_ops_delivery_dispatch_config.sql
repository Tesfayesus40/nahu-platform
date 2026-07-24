-- ============================================================================
-- Nahu Platform
-- Migration : ops/007_ops_delivery_dispatch_config.sql
-- Module    : Ops / Delivery (D4)
-- Description:
--     Dispatch workload limit setting for assignment engine.
-- ============================================================================

BEGIN;

INSERT INTO ops.system_settings (code, display_name, description, value_text)
VALUES
    (
        'delivery.dispatch.max_active_shipments',
        'Max active shipments per courier',
        'Maximum ASSIGNED/ACCEPTED/PICKED_UP/IN_TRANSIT shipments a courier may hold.',
        '3'
    )
ON CONFLICT (code) DO NOTHING;

COMMIT;
