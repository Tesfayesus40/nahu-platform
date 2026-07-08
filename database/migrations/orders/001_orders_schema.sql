-- ============================================================================
-- Nahu Platform
-- Migration : 001_orders_schema.sql
-- Module    : Orders
-- Author    : Package 004 (Orders & Certificates)
-- Description:
--     Creates the orders schema, covering the buyer/farmer transaction
--     flow and origin certificate issuance. Ported from nahu-buna-gebaya's
--     orders + origin_certificates tables.
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS orders;

COMMENT ON SCHEMA orders IS
'Order lifecycle and origin certificates for Nahu Platform. Ported from nahu-buna-gebaya.';

COMMIT;
