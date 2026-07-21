-- ============================================================================
-- Nahu Platform
-- Migration : identity/022_identity_dispute_permissions.sql
-- Module    : Identity
-- Description:
--     Seeds dispute management permissions and SUPPORT_AGENT role grants.
-- ============================================================================

BEGIN;

INSERT INTO identity.roles (code, display_name, description) VALUES
    (
        'SUPPORT_AGENT',
        'Support Agent',
        'Handles order dispute cases and low-risk support actions.'
    )
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.permissions (code, display_name, description) VALUES
    ('orders.disputes.read', 'View Disputes', 'View dispute queues and case detail.'),
    ('orders.disputes.manage', 'Manage Disputes', 'Assign, decide, escalate, and record refund intent on disputes.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
  AND permissions.code IN ('orders.disputes.read', 'orders.disputes.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code = 'SUPPORT_AGENT'
  AND permissions.code IN
  (
      'admin.dashboard.read',
      'orders.disputes.read',
      'orders.disputes.manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code = 'AUDITOR'
  AND permissions.code = 'orders.disputes.read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
