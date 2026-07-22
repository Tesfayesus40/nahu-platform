-- ============================================================================
-- Nahu Platform
-- Migration : identity/023_identity_batch2_permissions.sql
-- Module    : Identity
-- Description:
--     A6–A8 permissions: audit export, system config read/write.
-- ============================================================================

BEGIN;

INSERT INTO identity.permissions (code, display_name, description) VALUES
    (
        'audit.export',
        'Export Audit Events',
        'Export filtered administrative audit events (creates its own audit event).'
    ),
    (
        'admin.system.config.read',
        'View System Configuration',
        'View feature flags, release metadata, and system administration panels.'
    ),
    (
        'admin.system.config.write',
        'Change System Configuration',
        'Create or update feature flags and non-secret system settings.'
    )
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
  AND permissions.code IN
  (
      'audit.export',
      'admin.system.config.read',
      'admin.system.config.write'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code = 'AUDITOR'
  AND permissions.code IN ('audit.export', 'admin.system.config.read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
