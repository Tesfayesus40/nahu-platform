-- ============================================================================
-- Nahu Platform
-- Migration : catalog/011_catalog_marketplace_verticals.sql
-- Module    : Catalog (G2 Marketplace Engine)
-- Description:
--     Creates catalog.marketplace_verticals and seeds AGRICULTURE (active)
--     plus future verticals (inactive). Categories attach in 012.
-- ============================================================================

BEGIN;

CREATE TABLE catalog.marketplace_verticals
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(50) NOT NULL,

    name_en VARCHAR(100) NOT NULL,

    name_am VARCHAR(100),

    description TEXT,

    default_brand VARCHAR(150),

    compliance_profile_code VARCHAR(80),

    is_active BOOLEAN NOT NULL DEFAULT FALSE,

    sort_order SMALLINT NOT NULL DEFAULT 0,

    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_marketplace_verticals_code UNIQUE (code)
);

CREATE INDEX idx_marketplace_verticals_is_active
    ON catalog.marketplace_verticals (is_active);

COMMENT ON TABLE catalog.marketplace_verticals IS
'First-class marketplace verticals (Agriculture, Construction, …). Categories belong to exactly one vertical.';

INSERT INTO catalog.marketplace_verticals (
    code, name_en, name_am, description, default_brand, is_active, sort_order, metadata
)
VALUES
    (
        'AGRICULTURE',
        'Agriculture',
        'ግብርና',
        'Agricultural goods, supplies, and services — Nahu Farms experience pack.',
        'Nahu Farms',
        TRUE,
        10,
        '{"defaultListingKind":"GOODS","defaultAppFlavor":"nahu-farms","allowedSellerTypes":["FARMER","COOPERATIVE","COMPANY"]}'::jsonb
    ),
    (
        'CONSTRUCTION',
        'Construction',
        NULL,
        'Construction materials and related trade — future vertical.',
        NULL,
        FALSE,
        20,
        '{}'::jsonb
    ),
    (
        'MANUFACTURING',
        'Manufacturing',
        NULL,
        'Manufactured goods — future vertical.',
        NULL,
        FALSE,
        30,
        '{}'::jsonb
    ),
    (
        'RETAIL',
        'Retail',
        NULL,
        'General retail merchandise — future vertical.',
        NULL,
        FALSE,
        40,
        '{}'::jsonb
    ),
    (
        'HEALTHCARE',
        'Healthcare',
        NULL,
        'Healthcare supplies — future vertical (regulated).',
        NULL,
        FALSE,
        50,
        '{}'::jsonb
    ),
    (
        'LOGISTICS',
        'Logistics',
        NULL,
        'Logistics services marketplace — distinct from Nahu Delivery module.',
        NULL,
        FALSE,
        60,
        '{}'::jsonb
    ),
    (
        'TOURISM',
        'Tourism',
        NULL,
        'Tourism offerings — future vertical.',
        NULL,
        FALSE,
        70,
        '{}'::jsonb
    )
ON CONFLICT (code) DO NOTHING;

COMMIT;
