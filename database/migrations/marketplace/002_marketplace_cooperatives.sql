-- ============================================================================
-- Nahu Platform
-- Migration : 002_marketplace_cooperatives.sql
-- Module    : Marketplace
-- Author    : Package 003 (Marketplace)
-- Description:
--     Creates marketplace.cooperatives. Direct port of nahu-buna-gebaya's
--     Knex migration 002_create_cooperatives, unchanged in shape.
-- ============================================================================

BEGIN;

CREATE TABLE marketplace.cooperatives
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(200) NOT NULL,

    union_name VARCHAR(200),

    region VARCHAR(100) NOT NULL,

    zone VARCHAR(100),

    license_number VARCHAR(50),

    verified BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE marketplace.cooperatives IS
'Farmer cooperatives and unions participating in the marketplace.';

COMMIT;
