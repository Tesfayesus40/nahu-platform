-- ============================================================================
-- Nahu Platform
-- Migration : identity/024_identity_batch3_permissions.sql
-- Module    : Identity
-- Description:
--     A9–A11 permissions: orders/payments, delivery, promotions, cooperatives.
-- ============================================================================

BEGIN;

INSERT INTO identity.permissions (code, display_name, description) VALUES
    ('orders.read', 'View Orders', 'View order queues and order detail in Admin Portal.'),
    ('orders.transition', 'Transition Orders', 'Perform guarded administrative order/payment transitions.'),
    ('payments.read', 'View Payments', 'View payment method and escrow reference information on orders.'),
    ('delivery.read', 'View Delivery Handoff', 'View fulfillment / delivery handoff cases.'),
    ('delivery.manage', 'Manage Delivery Handoff', 'Update fulfillment status and logistics handoff fields.'),
    ('marketplace.promotions.read', 'View Promotions', 'View marketplace promotion definitions.'),
    ('marketplace.promotions.manage', 'Manage Promotions', 'Create and update promotion definitions (not applied at checkout yet).'),
    ('marketplace.cooperatives.read', 'View Cooperatives', 'View cooperative directory and verification status.'),
    ('marketplace.cooperatives.manage', 'Manage Cooperatives', 'Update cooperative operational notes and directory fields.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code IN ('SUPER_ADMIN', 'PLATFORM_ADMIN')
  AND permissions.code IN
  (
      'orders.read',
      'orders.transition',
      'payments.read',
      'delivery.read',
      'delivery.manage',
      'marketplace.promotions.read',
      'marketplace.promotions.manage',
      'marketplace.cooperatives.read',
      'marketplace.cooperatives.manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code = 'SUPPORT_AGENT'
  AND permissions.code IN
  (
      'orders.read',
      'orders.transition',
      'payments.read',
      'delivery.read',
      'delivery.manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code = 'MARKETPLACE_MODERATOR'
  AND permissions.code IN
  (
      'marketplace.promotions.read',
      'marketplace.promotions.manage',
      'marketplace.cooperatives.read',
      'marketplace.cooperatives.manage',
      'orders.read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT roles.id, permissions.id
FROM identity.roles AS roles
CROSS JOIN identity.permissions AS permissions
WHERE roles.code = 'AUDITOR'
  AND permissions.code IN
  (
      'orders.read',
      'payments.read',
      'delivery.read',
      'marketplace.promotions.read',
      'marketplace.cooperatives.read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
