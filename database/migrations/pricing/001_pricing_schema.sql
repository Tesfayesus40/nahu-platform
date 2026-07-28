-- ============================================================================
-- Nahu Platform
-- Migration : pricing/001_pricing_schema.sql
-- Module    : Pricing
-- Description:
--     Revenue engine — pricing schema for versioned fee schedules.
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS pricing;

COMMENT ON SCHEMA pricing IS
'Configurable marketplace fees, delivery tariffs, and commissions for the Nahu revenue engine.';

COMMIT;
