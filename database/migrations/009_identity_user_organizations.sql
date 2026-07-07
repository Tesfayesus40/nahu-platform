-- ============================================================================
-- Nahu Platform
-- Migration : 009_identity_user_organizations.sql
-- Module    : Identity
-- Author    : Tesfayesus Yimenu Yirdaw
-- Description:
--     Creates the identity.user_organizations table.
-- ============================================================================

BEGIN;

CREATE TABLE identity.user_organizations
(
    user_id UUID NOT NULL,

    organization_id UUID NOT NULL,

    position_title VARCHAR(100),

    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    is_primary BOOLEAN NOT NULL DEFAULT FALSE,

    PRIMARY KEY (user_id, organization_id),

    CONSTRAINT fk_user_org_user
        FOREIGN KEY (user_id)
        REFERENCES identity.users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_org_organization
        FOREIGN KEY (organization_id)
        REFERENCES identity.organizations(id)
        ON DELETE CASCADE
);

-- ============================================================================
-- Table Comments
-- ============================================================================

COMMENT ON TABLE identity.user_organizations IS
'Associates users with organizations they belong to.';

-- ============================================================================
-- Column Comments
-- ============================================================================

COMMENT ON COLUMN identity.user_organizations.user_id IS
'The user who belongs to the organization.';

COMMENT ON COLUMN identity.user_organizations.organization_id IS
'The organization the user belongs to.';

COMMENT ON COLUMN identity.user_organizations.position_title IS
'Business position held by the user within the organization (e.g., Manager, Owner).';

COMMENT ON COLUMN identity.user_organizations.joined_at IS
'Date and time the user joined the organization.';

COMMENT ON COLUMN identity.user_organizations.is_primary IS
'Indicates whether this is the user''s primary organization.';

-- ============================================================================
-- End of Migration
-- ============================================================================

COMMIT;