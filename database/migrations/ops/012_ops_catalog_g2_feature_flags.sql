-- ============================================================================
-- Nahu Platform
-- Migration : ops/012_ops_catalog_g2_feature_flags.sql
-- Module    : Ops / Catalog G2
-- Description:
--     Feature flag for Admin Catalog write operations. Default ON so G2 Admin
--     works after deploy; disable to freeze taxonomy edits without redeploy.
-- ============================================================================

BEGIN;

INSERT INTO ops.feature_flags (code, display_name, description, enabled)
VALUES (
    'catalog.admin.write.enabled',
    'Catalog Admin Write',
    'When enabled, Admin users with catalog.write may create/update verticals, categories, products, and varieties.',
    TRUE
)
ON CONFLICT (code) DO NOTHING;

COMMIT;
