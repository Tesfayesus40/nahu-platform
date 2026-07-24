-- ============================================================================
-- Nahu Platform
-- Migration : ops/009_ops_delivery_pod_requirements.sql
-- Module    : Ops / Delivery (D10)
-- Description:
--     Configurable Proof-of-Delivery requirements for ARRIVED → DELIVERED.
--     Signature capture remains schema-ready only (not a requirement flag).
-- ============================================================================

BEGIN;

INSERT INTO ops.feature_flags (code, display_name, description, enabled)
VALUES
    (
        'delivery.pod.otp_required',
        'POD OTP required',
        'When enabled, DROPOFF POD must verify a delivery OTP before DELIVERED.',
        TRUE
    ),
    (
        'delivery.pod.photo_required',
        'POD photo required',
        'When enabled, DROPOFF POD must include a photo URL / media reference.',
        TRUE
    ),
    (
        'delivery.pod.gps_required',
        'POD GPS required',
        'When enabled, DROPOFF POD must include capture lat/lng.',
        FALSE
    ),
    (
        'delivery.pod.recipient_required',
        'POD recipient name required',
        'When enabled, DROPOFF POD must include recipient name.',
        TRUE
    )
ON CONFLICT (code) DO NOTHING;

COMMIT;
