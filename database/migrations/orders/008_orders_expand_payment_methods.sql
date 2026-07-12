-- ============================================================================
-- Nahu Platform
-- Migration : 008_orders_expand_payment_methods.sql
-- Module    : Orders
-- Description:
--     Adds payment provider enum values for future integrations.
--     Only TELEBIRR and CBE_BIRR are active in the mobile app today;
--     others are reserved for Pack 4 architecture stubs.
-- ============================================================================

BEGIN;

ALTER TYPE orders.payment_method ADD VALUE IF NOT EXISTS 'MPESA';
ALTER TYPE orders.payment_method ADD VALUE IF NOT EXISTS 'CHAPA';
ALTER TYPE orders.payment_method ADD VALUE IF NOT EXISTS 'SANTIMPAY';

COMMIT;
