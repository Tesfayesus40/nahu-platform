-- ============================================================================
-- Nahu Platform
-- Migration : 012_identity_seed_core_roles.sql
-- Module    : Identity
-- Author    : Package 002 (Identity & Auth)
-- Description:
--     Seeds the business roles needed for Package 002's registration flow.
--     Matches the actor codes already defined in
--     docs/business/business-actors.md. Only FARMER, BUYER, and ADMIN are
--     seeded here because those are the roles the current registration
--     endpoint actually assigns; the remaining actors from
--     business-actors.md (Cooperative, Exporter, Logistics, Finance, etc.)
--     should be seeded by whichever package first needs them, to avoid
--     this migration guessing at fields those modules haven't designed yet.
-- ============================================================================

BEGIN;

INSERT INTO identity.roles (code, display_name, description) VALUES
    ('FARMER', 'Farmer', 'Produces agricultural products and lists them for sale.'),
    ('BUYER',  'Buyer',  'Purchases agricultural products through the platform.'),
    ('ADMIN',  'Administrator', 'Full platform administration.')
ON CONFLICT (code) DO NOTHING;

COMMIT;
