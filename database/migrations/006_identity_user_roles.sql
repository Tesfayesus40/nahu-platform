-- ============================================================================
-- Nahu Platform
-- Migration : 006_identity_user_roles.sql
-- Module    : Identity
-- Author    : Tesfayesus Yimenu Yirdaw
-- Description:
--     Creates the identity.user_roles table.
-- ============================================================================

BEGIN;

CREATE TABLE identity.user_roles
(
    user_id UUID NOT NULL,

    role_id UUID NOT NULL,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    assigned_by UUID,

    PRIMARY KEY (user_id, role_id),

    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id)
        REFERENCES identity.users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (role_id)
        REFERENCES identity.roles(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user_roles_assigned_by
        FOREIGN KEY (assigned_by)
        REFERENCES identity.users(id)
        ON DELETE SET NULL
);

-- ============================================================================
-- Table Comments
-- ============================================================================

COMMENT ON TABLE identity.user_roles IS
'Associates users with one or more business roles.';

-- ============================================================================
-- Column Comments
-- ============================================================================

COMMENT ON COLUMN identity.user_roles.user_id IS
'The user receiving the role.';

COMMENT ON COLUMN identity.user_roles.role_id IS
'The role assigned to the user.';

COMMENT ON COLUMN identity.user_roles.assigned_at IS
'Date and time when the role was assigned.';

COMMENT ON COLUMN identity.user_roles.assigned_by IS
'User who assigned the role, if applicable.';

-- ============================================================================
-- End of Migration
-- ============================================================================

COMMIT;