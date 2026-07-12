-- ============================================================================
-- Nahu Platform
-- Migration : 007_marketplace_add_grade_unknown.sql
-- Module    : Marketplace
-- Description:
--     Adds GRADE_UNKNOWN for coffee lots that have not been graded yet.
--     Mobile apps display this as "Ungraded" / "ያልተመደበ".
-- ============================================================================

BEGIN;

ALTER TYPE marketplace.coffee_grade ADD VALUE IF NOT EXISTS 'GRADE_UNKNOWN';

COMMIT;
