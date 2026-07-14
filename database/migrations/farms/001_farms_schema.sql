-- ============================================================================
-- Nahu Platform
-- Migration : 001_farms_schema.sql
-- Module    : Farms (Phase 4.1)
-- Description: Creates the farms schema.
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS farms;

COMMENT ON SCHEMA farms IS
'Nahu Farm — farm holdings, hierarchy, parties, and ops metadata.';

COMMIT;
