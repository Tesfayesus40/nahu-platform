-- ============================================================================
-- Nahu Platform
-- Migration : ops/005_ops_alert_thresholds.sql
-- Module    : Ops / Monitoring (A14)
-- Description:
--     Configurable alert thresholds evaluated live against domain metrics.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ops.alert_thresholds
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    metric_key VARCHAR(80) NOT NULL,
    warn_above NUMERIC(12, 2),
    critical_above NUMERIC(12, 2),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ops_alert_thresholds_code UNIQUE (code)
);

INSERT INTO ops.alert_thresholds
    (code, display_name, description, metric_key, warn_above, critical_above, enabled)
VALUES
    (
        'audit.denied.7d',
        'Denied audit actions (7d)',
        'Warn when denied privileged actions in the last 7 days exceed threshold.',
        'audit.denied_7d',
        10,
        50,
        TRUE
    ),
    (
        'orders.stalled_escrow',
        'Stalled escrow orders',
        'Orders in PAID_ESCROW older than policy window.',
        'orders.stalled_escrow',
        5,
        20,
        TRUE
    ),
    (
        'delivery.exceptions',
        'Delivery exceptions',
        'Open fulfillment EXCEPTION cases.',
        'delivery.exceptions',
        3,
        15,
        TRUE
    ),
    (
        'verification.pending',
        'Pending verifications',
        'Verification cases awaiting review.',
        'verification.pending',
        20,
        100,
        TRUE
    )
ON CONFLICT (code) DO NOTHING;

INSERT INTO ops.feature_flags (code, display_name, description, enabled)
VALUES
    (
        'admin.reports.enabled',
        'Admin reports',
        'Enable Reporting & BI surfaces in Admin Portal.',
        TRUE
    ),
    (
        'admin.notifications.enabled',
        'Admin notifications',
        'Enable Notification Center in Admin Portal.',
        TRUE
    ),
    (
        'admin.monitoring.alerts',
        'Monitoring alerts',
        'Evaluate alert thresholds on the System / Monitoring page.',
        TRUE
    )
ON CONFLICT (code) DO NOTHING;

COMMIT;
