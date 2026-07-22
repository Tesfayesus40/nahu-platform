-- ============================================================================
-- Nahu Platform
-- Migration : identity/025_identity_batch4_permissions.sql
-- Module    : Identity
-- Description:
--     A12–A14 permissions: reports, notifications, monitoring.
-- ============================================================================

BEGIN;

INSERT INTO identity.permissions (code, display_name, description) VALUES
    ('reports.read', 'View Reports', 'View report catalog and past report jobs.'),
    ('reports.export', 'Run Report Exports', 'Request domain report exports (creates audit events).'),
    ('notifications.read', 'View Notifications', 'View Admin Notification Center.'),
    ('notifications.manage', 'Manage Notifications', 'Mark notifications read or publish operational notices.'),
    ('monitoring.read', 'View Platform Monitoring', 'View monitoring metrics and alert evaluations.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
  AND permissions.code IN
  (
      'reports.read',
      'reports.export',
      'notifications.read',
      'notifications.manage',
      'monitoring.read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code = 'AUDITOR'
  AND permissions.code IN
  (
      'reports.read',
      'reports.export',
      'notifications.read',
      'monitoring.read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code IN ('SUPPORT_AGENT', 'MARKETPLACE_MODERATOR')
  AND permissions.code IN ('notifications.read', 'reports.read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
