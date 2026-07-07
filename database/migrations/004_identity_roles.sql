-- ============================================================================
-- Nahu Platform
-- Migration : 004_identity_roles.sql
-- Module    : Identity
-- Author    : Tesfayesus Yimenu Yirdaw
-- Description:
--     Creates the identity.roles table.
-- ============================================================================

BEGIN;

CREATE TABLE identity.roles
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(50) NOT NULL UNIQUE,

    display_name VARCHAR(100) NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE identity.roles IS
'Defines the business roles available within the platform.';

COMMENT ON COLUMN identity.roles.code IS
'Permanent internal business code (e.g., FARMER, BUYER, EXPORTER, ADMIN).';

COMMENT ON COLUMN identity.roles.display_name IS
'Human-readable role name displayed in the user interface.';

COMMIT;