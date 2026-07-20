-- ============================================================================
-- Nahu Platform
-- Migration : identity/018_identity_seed_admin_roles_permissions.sql
-- Module    : Identity
-- Description:
--     Seeds administrator roles, permissions, and role grants.
-- ============================================================================

BEGIN;

INSERT INTO identity.roles (code, display_name, description) VALUES
    ('SUPER_ADMIN', 'Super Administrator', 'Full access to all administrative capabilities.'),
    ('PLATFORM_ADMIN', 'Platform Administrator', 'Manages platform administration and operations.'),
    ('AUDITOR', 'Auditor', 'Read-only access to administrative and audit information.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.permissions (code, display_name, description) VALUES
    ('admin.dashboard.read', 'View Admin Dashboard', 'View the administrative dashboard.'),
    ('admin.system.health.read', 'View System Health', 'View platform system health information.'),
    ('identity.users.read', 'View Users', 'View platform users.'),
    ('identity.users.invite', 'Invite Users', 'Invite users to administrative roles.'),
    ('identity.sessions.revoke', 'Revoke Sessions', 'Revoke administrator sessions.'),
    ('identity.roles.read', 'View Roles', 'View identity roles and permissions.'),
    ('audit.read', 'View Audit Events', 'View administrative audit events.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
  AND permissions.code IN
  (
      'admin.dashboard.read',
      'admin.system.health.read',
      'identity.users.read',
      'identity.users.invite',
      'identity.sessions.revoke',
      'identity.roles.read',
      'audit.read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code = 'AUDITOR'
  AND permissions.code IN
  (
      'admin.dashboard.read',
      'admin.system.health.read',
      'identity.users.read',
      'identity.roles.read',
      'audit.read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
