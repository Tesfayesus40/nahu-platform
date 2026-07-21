-- ============================================================================
-- Nahu Platform
-- Migration : identity/020_identity_verification_permissions.sql
-- Module    : Identity
-- Description:
--     Seeds participant verification permissions and MARKETPLACE_MODERATOR role.
-- ============================================================================

BEGIN;

INSERT INTO identity.roles (code, display_name, description) VALUES
    (
        'MARKETPLACE_MODERATOR',
        'Marketplace Moderator',
        'Reviews farmer and merchant verification and related marketplace queues.'
    )
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.permissions (code, display_name, description) VALUES
    ('verification.read', 'View Verification Queues', 'View participant verification cases and documents.'),
    ('farmers.verify', 'Verify Farmers', 'Approve, reject, or request info for farmer verification.'),
    ('buyers.verify', 'Verify Buyers', 'Approve, reject, or request info for buyer verification.'),
    ('marketplace.merchants.verify', 'Verify Merchants', 'Approve, reject, or request info for merchant/cooperative verification.'),
    ('identity.organizations.verify', 'Verify Organizations', 'Approve, reject, or request info for organization verification.')
ON CONFLICT (code) DO NOTHING;

-- Full admin roles
INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
  AND permissions.code IN
  (
      'verification.read',
      'farmers.verify',
      'buyers.verify',
      'marketplace.merchants.verify',
      'identity.organizations.verify'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Marketplace moderator: farmers + merchants + read
INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code = 'MARKETPLACE_MODERATOR'
  AND permissions.code IN
  (
      'admin.dashboard.read',
      'verification.read',
      'farmers.verify',
      'marketplace.merchants.verify'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Auditor read-only
INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code = 'AUDITOR'
  AND permissions.code = 'verification.read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
