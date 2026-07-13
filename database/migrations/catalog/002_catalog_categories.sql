-- ============================================================================
-- Nahu Platform
-- Migration : 002_catalog_categories.sql
-- Module    : Catalog
-- Phase     : 2 — Nahu Farms generalization
-- Description:
--     Creates catalog.categories and seeds COFFEE as the first active category.
--     Additional categories (cereals, pulses, etc.) will be added in a later phase.
-- ============================================================================

BEGIN;

CREATE TABLE catalog.categories
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(50) NOT NULL UNIQUE,

    name_en VARCHAR(100) NOT NULL,

    name_am VARCHAR(100) NOT NULL,

    description_en TEXT,

    description_am TEXT,

    is_active BOOLEAN NOT NULL DEFAULT FALSE,

    sort_order SMALLINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_is_active ON catalog.categories (is_active);

COMMENT ON TABLE catalog.categories IS
'Top-level agricultural product categories for Nahu Farms (e.g. COFFEE, CEREALS).';

COMMENT ON COLUMN catalog.categories.code IS
'Stable internal category code used in APIs and listings (uppercase snake).';

INSERT INTO catalog.categories (code, name_en, name_am, description_en, description_am, is_active, sort_order)
VALUES (
    'COFFEE',
    'Coffee',
    'ቡና',
    'Ethiopian coffee — washed, natural, and specialty lots.',
    'የኢትዮጵያ ቡና — የታጠበ፣ ተፈጥሮአዊ እና ልዩ ዓይነት ቡና።',
    TRUE,
    1
)
ON CONFLICT (code) DO NOTHING;

COMMIT;
