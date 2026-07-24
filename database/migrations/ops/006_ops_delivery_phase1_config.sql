-- ============================================================================
-- Nahu Platform
-- Migration : ops/006_ops_delivery_phase1_config.sql
-- Module    : Ops / Delivery (D1)
-- Description:
--     Delivery Phase 1 config: feature flags (AD-1, courier app, analytics),
--     system_settings for non-boolean values (earnings flat fee), and
--     alert thresholds for delivery analytics readiness (RF-8).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ops.system_settings
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    value_text TEXT NOT NULL,
    updated_by_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ops_system_settings_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_ops_system_settings_code
    ON ops.system_settings (code);

INSERT INTO ops.feature_flags (code, display_name, description, enabled)
VALUES
    (
        'delivery.buyer_confirm_required',
        'Buyer confirm required after delivery',
        'When enabled, POD advances order to DELIVERED only; buyer or Admin must confirm to COMPLETED.',
        TRUE
    ),
    (
        'delivery.buyer_confirm_from_escrow',
        'Buyer confirm from escrow (legacy)',
        'When enabled, buyer may confirm from PAID_ESCROW only if no active shipment exists.',
        FALSE
    ),
    (
        'delivery.pickup_pod_required',
        'Pickup POD required',
        'When enabled, PICKUP stops require proof-of-delivery to complete.',
        FALSE
    ),
    (
        'delivery.courier_app.enabled',
        'Courier app / OTP enabled',
        'When disabled, OTP registration and login with role COURIER is rejected.',
        TRUE
    ),
    (
        'delivery.analytics.enabled',
        'Delivery analytics collection',
        'When enabled, lifecycle events feed delivery analytics counters (RF-8).',
        TRUE
    )
ON CONFLICT (code) DO NOTHING;

INSERT INTO ops.system_settings (code, display_name, description, value_text)
VALUES
    (
        'delivery.earning.flat_etb',
        'Courier flat earning (ETB)',
        'Flat fee accrued per completed DROPOFF stop (immutable ledger). Ops may change value_text.',
        '0'
    )
ON CONFLICT (code) DO NOTHING;

INSERT INTO ops.alert_thresholds
    (code, display_name, description, metric_key, warn_above, critical_above, enabled)
VALUES
    (
        'delivery.in_transit',
        'Deliveries in transit',
        'Open fulfillment cases in IN_TRANSIT (analytics / monitoring).',
        'delivery.in_transit',
        25,
        100,
        TRUE
    ),
    (
        'delivery.pod_pending',
        'POD pending',
        'Shipments in progress awaiting dropoff POD.',
        'delivery.pod_pending',
        15,
        50,
        TRUE
    )
ON CONFLICT (code) DO NOTHING;

COMMIT;
