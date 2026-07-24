-- ============================================================================
-- Nahu Platform
-- Migration : identity/026_identity_delivery_phase1_permissions.sql
-- Module    : Identity
-- Description:
--     D1 Delivery Phase 1: seed COURIER role and delivery earnings/courier
--     management permissions (extends A10 delivery.read / delivery.manage).
-- ============================================================================

BEGIN;

INSERT INTO identity.roles (code, display_name, description) VALUES
    (
        'COURIER',
        'Courier',
        'Delivers marketplace orders; authenticates via OTP (Delivery Phase 1).'
    )
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.permissions (code, display_name, description) VALUES
    (
        'delivery.earnings.read',
        'View Courier Earnings',
        'View courier earnings ledger in Admin Portal.'
    ),
    (
        'delivery.earnings.manage',
        'Manage Courier Earnings',
        'Adjust or void courier earnings ledger entries (reauth required).'
    ),
    (
        'delivery.couriers.manage',
        'Manage Couriers',
        'Verify, suspend, or update courier operational flags.'
    )
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
  AND permissions.code IN
  (
      'delivery.earnings.read',
      'delivery.earnings.manage',
      'delivery.couriers.manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code = 'SUPPORT_AGENT'
  AND permissions.code IN
  (
      'delivery.earnings.read',
      'delivery.couriers.manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code = 'AUDITOR'
  AND permissions.code = 'delivery.earnings.read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
