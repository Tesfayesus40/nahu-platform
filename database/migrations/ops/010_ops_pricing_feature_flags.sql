-- ============================================================================
-- Nahu Platform
-- Migration : ops/010_ops_pricing_feature_flags.sql
-- Module    : Ops
-- Description:
--     Feature flags for revenue engine rollout.
-- ============================================================================

BEGIN;

INSERT INTO ops.feature_flags (code, display_name, description, enabled)
VALUES
    (
        'pricing.v1.enabled',
        'Pricing engine v1',
        'When enabled, orders use DB fee schedules (buyer + farmer fees) instead of hardcoded 2% commission only.',
        TRUE
    ),
    (
        'delivery.dynamic_fee.enabled',
        'Dynamic delivery fees',
        'When enabled, NAHU_COURIER orders require a delivery quote and charge delivery_fee to the buyer. Keep FALSE until routing, vehicle selection, and real distance are implemented.',
        FALSE
    )
ON CONFLICT (code) DO NOTHING;

COMMIT;
