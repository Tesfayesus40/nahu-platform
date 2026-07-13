-- ============================================================================
-- Nahu Platform
-- Migration : 001_catalog_schema.sql
-- Module    : Catalog
-- Phase     : 2 — Nahu Farms generalization (category foundation)
-- Description:
--     Creates the catalog schema for agricultural product taxonomy.
--     Phase 2 seeds COFFEE only; additional categories land in a later phase.
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS catalog;

COMMENT ON SCHEMA catalog IS
'Agricultural product catalog for Nahu Farms — categories, products, and attributes.';

COMMIT;
