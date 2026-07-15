-- ============================================================================
-- Nahu Platform
-- Migration : 002_warehouse_enums.sql
-- Module    : Warehouse (Phase 4.3)
-- ============================================================================

BEGIN;

CREATE TYPE warehouse.site_type AS ENUM
(
    'ON_FARM',
    'COOPERATIVE',
    'NAHU',
    'THIRD_PARTY'
);

CREATE TYPE warehouse.site_status AS ENUM
(
    'ACTIVE',
    'INACTIVE'
);

CREATE TYPE warehouse.party_role AS ENUM
(
    'OWNER',
    'MANAGER',
    'VIEWER'
);

CREATE TYPE warehouse.party_status AS ENUM
(
    'ACTIVE',
    'INACTIVE'
);

COMMIT;
