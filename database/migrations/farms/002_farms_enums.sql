-- ============================================================================
-- Nahu Platform
-- Migration : 002_farms_enums.sql
-- Module    : Farms (Phase 4.1)
-- ============================================================================

BEGIN;

CREATE TYPE farms.farm_status AS ENUM
(
    'DRAFT',
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED',
    'ARCHIVED'
);

CREATE TYPE farms.tenure_type AS ENUM
(
    'OWNED',
    'LEASED',
    'COOPERATIVE',
    'CUSTOMARY',
    'MIXED',
    'OTHER'
);

CREATE TYPE farms.party_role AS ENUM
(
    'OWNER',
    'CO_OWNER',
    'OPERATOR',
    'TENANT',
    'COOP_MANAGER',
    'VIEWER'
);

CREATE TYPE farms.production_unit_kind AS ENUM
(
    'GENERIC',
    'TREE_BLOCK',
    'GREENHOUSE',
    'PEN',
    'POND',
    'APIARY',
    'OTHER'
);

CREATE TYPE farms.audit_entity_type AS ENUM
(
    'FARM',
    'PLOT',
    'FIELD',
    'PARTY',
    'PRODUCTION_UNIT'
);

CREATE TYPE farms.audit_action AS ENUM
(
    'CREATE',
    'UPDATE',
    'STATUS_CHANGE',
    'PARTY_ADD',
    'PARTY_END'
);

COMMIT;
