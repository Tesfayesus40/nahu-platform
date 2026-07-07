-- ============================================================================
-- Nahu Platform
-- Migration : 007_identity_role_permissions.sql
-- Module    : Identity
-- Author    : Tesfayesus Yimenu Yirdaw
-- Description:
--     Creates the identity.role_permissions table.
-- ============================================================================

BEGIN;

CREATE TABLE identity.role_permissions
(
    role_id UUID NOT NULL,

    permission_id UUID NOT NULL,

    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    granted_by UUID,

    PRIMARY KEY (role_id, permission_id),

    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id)
        REFERENCES identity.roles(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id)
        REFERENCES identity.permissions(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_role_permissions_granted_by
        FOREIGN KEY (granted_by)
        REFERENCES identity.users(id)
        ON DELETE SET NULL
);

-- ============================================================================
-- Table Comments
-- ============================================================================

COMMENT ON TABLE identity.role_permissions IS
'Associates roles with permissions.';

-- ============================================================================
-- Column Comments
-- ============================================================================

COMMENT ON COLUMN identity.role_permissions.role_id IS
'Role receiving the permission.';

COMMENT ON COLUMN identity.role_permissions.permission_id IS
'Permission granted to the role.';

COMMENT ON COLUMN identity.role_permissions.granted_at IS
'Date and time the permission was granted.';

COMMENT ON COLUMN identity.role_permissions.granted_by IS
'User who granted the permission.';

-- ============================================================================
-- End of Migration
-- ============================================================================

COMMIT;