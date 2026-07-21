-- ============================================================================
-- Nahu Platform
-- Migration : identity/021_identity_listing_moderation_permissions.sql
-- Module    : Identity
-- Description:
--     Seeds listing moderation read/moderate permissions.
-- ============================================================================

BEGIN;

INSERT INTO identity.permissions (code, display_name, description) VALUES
    ('marketplace.listings.read', 'View Listings', 'View marketplace listings in the Admin Portal.'),
    ('marketplace.listings.moderate', 'Moderate Listings', 'Approve, reject, suspend, or flag marketplace listings.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
  AND permissions.code IN
  (
      'marketplace.listings.read',
      'marketplace.listings.moderate'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code = 'MARKETPLACE_MODERATOR'
  AND permissions.code IN
  (
      'marketplace.listings.read',
      'marketplace.listings.moderate'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code = 'AUDITOR'
  AND permissions.code = 'marketplace.listings.read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
