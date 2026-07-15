-- ============================================================================
-- Nahu Platform
-- Migration : 001_inventory_schema.sql
-- Module    : Inventory (Phase 4.2)
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS inventory;

COMMENT ON SCHEMA inventory IS
'Nahu Farm inventory — stock lots and append-only movements for catalog products.';

COMMIT;
