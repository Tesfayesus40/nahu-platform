-- ============================================================================
-- Nahu Platform
-- Migration : 001_warehouse_schema.sql
-- Module    : Warehouse (Phase 4.3)
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS warehouse;

COMMENT ON SCHEMA warehouse IS
'Nahu Farm warehouse readiness — storage sites and access parties (bins/zones later).';

COMMIT;
