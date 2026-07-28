-- ============================================================================
-- Nahu Platform
-- Migration : ops/011_ops_disable_dynamic_delivery_fee.sql
-- Module    : Ops
-- Description:
--     Architecture review: keep delivery.dynamic_fee.enabled OFF until
--     routing, vehicle selection, and real delivery distance ship.
-- ============================================================================

BEGIN;

UPDATE ops.feature_flags
SET
    enabled = FALSE,
    description = 'When enabled, NAHU_COURIER orders require a delivery quote and charge delivery_fee to the buyer. Keep FALSE until routing, vehicle selection, and real distance are implemented.',
    updated_at = NOW()
WHERE code = 'delivery.dynamic_fee.enabled';

COMMIT;
