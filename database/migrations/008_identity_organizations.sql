-- ============================================================================
-- Nahu Platform
-- Migration : 008_identity_organizations.sql
-- Module    : Identity
-- Author    : Tesfayesus Yimenu Yirdaw
-- Description:
--     Creates the identity.organizations table.
-- ============================================================================

BEGIN;

CREATE TABLE identity.organizations
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(50) NOT NULL UNIQUE,

    name VARCHAR(255) NOT NULL,

    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    deleted_at TIMESTAMPTZ
);

-- ============================================================================
-- Table Comments
-- ============================================================================

COMMENT ON TABLE identity.organizations IS
'Stores organizations that participate in the Nahu Platform.';

-- ============================================================================
-- Column Comments
-- ============================================================================

COMMENT ON COLUMN identity.organizations.code IS
'Permanent internal organization code.';

COMMENT ON COLUMN identity.organizations.name IS
'Official organization name.';

COMMENT ON COLUMN identity.organizations.description IS
'Additional information about the organization.';

COMMENT ON COLUMN identity.organizations.is_active IS
'Indicates whether the organization is active.';

-- ============================================================================
-- End of Migration
-- ============================================================================

COMMIT;