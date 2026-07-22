-- ============================================================================
-- Nahu Platform
-- Migration : marketplace/015_marketplace_promotions.sql
-- Module    : Marketplace
-- Description:
--     Admin-managed promotions registry (A11). Not applied at checkout yet —
--     checkout integration is a future Commerce/Delivery expansion.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS marketplace.promotions
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED')),
    scope_type VARCHAR(20) NOT NULL DEFAULT 'PLATFORM'
        CHECK (scope_type IN (
            'PLATFORM', 'CATEGORY', 'PRODUCT', 'LISTING', 'REGION'
        )),
    scope_ref VARCHAR(100),
    discount_type VARCHAR(20)
        CHECK (discount_type IS NULL OR discount_type IN ('PERCENT', 'FIXED_ETB')),
    discount_value NUMERIC(12, 2),
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    metadata_json JSONB,
    created_by_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    updated_by_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_marketplace_promotions_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_promotions_status
    ON marketplace.promotions (status);

CREATE INDEX IF NOT EXISTS idx_marketplace_promotions_scope
    ON marketplace.promotions (scope_type, scope_ref);

COMMIT;
