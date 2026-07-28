-- ============================================================================
-- Nahu Platform
-- Migration : identity/028_identity_seller_party_permissions.sql
-- Module    : Identity (G7)
-- Description: Admin permissions for seller party read/write.
-- ============================================================================

BEGIN;

INSERT INTO identity.permissions (code, display_name, description) VALUES
    ('seller.read', 'View Sellers', 'View seller parties and types in Admin.'),
    ('seller.write', 'Manage Sellers', 'Update seller party status and verification.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
  AND permissions.code IN ('seller.read', 'seller.write')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code = 'AUDITOR'
  AND permissions.code = 'seller.read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
