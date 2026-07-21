-- ============================================================================
-- Nahu Platform
-- Migration : identity/019_identity_user_management_permissions.sql
-- Module    : Identity
-- Description:
--     Seeds A2 User Management permissions and grants them to admin roles.
-- ============================================================================

BEGIN;

INSERT INTO identity.permissions (code, display_name, description) VALUES
    ('identity.users.status.write', 'Change User Status', 'Activate, deactivate, suspend, lock, or unlock users.'),
    ('identity.roles.assign', 'Assign Roles', 'Assign workforce roles to users.'),
    ('identity.users.mfa.reset', 'Reset User MFA', 'Reset multi-factor authentication for a workforce user.'),
    ('identity.users.password.reset', 'Reset User Password', 'Issue a temporary password reset for a workforce user.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
  AND permissions.code IN
  (
      'identity.users.status.write',
      'identity.roles.assign',
      'identity.users.mfa.reset',
      'identity.users.password.reset'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
