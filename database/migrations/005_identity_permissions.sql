-- ============================================================================
-- Nahu Platform
-- Migration : 005_identity_permissions.sql
-- Module    : Identity
-- Author    : Tesfayesus Yimenu Yirdaw
-- Description:
--     Creates the identity.permissions table.
-- ============================================================================

BEGIN;

CREATE TABLE identity.permissions
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(100) NOT NULL UNIQUE,

    display_name VARCHAR(150) NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Table Comments
-- ============================================================================

COMMENT ON TABLE identity.permissions IS
'Defines all permissions that can be assigned to roles within the platform.';

-- ============================================================================
-- Column Comments
-- ============================================================================

COMMENT ON COLUMN identity.permissions.code IS
'Permanent internal permission code (e.g., users.create, listings.publish).';

COMMENT ON COLUMN identity.permissions.display_name IS
'Human-readable permission name displayed in administrative interfaces.';

COMMENT ON COLUMN identity.permissions.description IS
'Description of what this permission allows.';

-- ============================================================================
-- End of Migration
-- ============================================================================

COMMIT;