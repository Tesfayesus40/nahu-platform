-- ============================================================================
-- Nahu Platform
-- Migration : identity/027_identity_catalog_g2_permissions.sql
-- Module    : Identity / Catalog G2
-- Description:
--     Admin Catalog Foundation permissions (verticals, categories, products,
--     varieties). Granted to SUPER_ADMIN and PLATFORM_ADMIN; read to AUDITOR.
-- ============================================================================

BEGIN;

INSERT INTO identity.permissions (code, display_name, description) VALUES
    ('catalog.read', 'View Catalog', 'View marketplace verticals, categories, products, and varieties in Admin.'),
    ('catalog.write', 'Manage Catalog', 'Create and update marketplace verticals, categories, products, and varieties.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
  AND permissions.code IN ('catalog.read', 'catalog.write')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code = 'AUDITOR'
  AND permissions.code = 'catalog.read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
