-- ============================================================================
-- Nahu Platform
-- Migration : identity/029_identity_payment_orchestration_permissions.sql
-- Module    : Identity (G9)
-- Description: Admin permissions for payment / escrow / settlement orchestration.
-- ============================================================================

BEGIN;

INSERT INTO identity.permissions (code, display_name, description) VALUES
    ('payment.read', 'View Payments', 'View payment cases, escrow, settlement and refund status.'),
    ('payment.manage', 'Manage Payments', 'Settle, refund, and transition payment orchestration.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
  AND permissions.code IN ('payment.read', 'payment.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code = 'AUDITOR'
  AND permissions.code = 'payment.read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
