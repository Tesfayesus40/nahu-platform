-- ============================================================================
-- Nahu Platform
-- Migration : 004_catalog_products.sql
-- Module    : Catalog
-- Phase     : 3 — Product Catalog
-- Description:
--     Creates catalog.products with lifecycle status independent of categories.
-- ============================================================================

BEGIN;

CREATE TYPE catalog.product_status AS ENUM
(
    'ACTIVE',
    'INACTIVE',
    'COMING_SOON',
    'DISCONTINUED'
);

CREATE TABLE catalog.products
(
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    category_id       UUID NOT NULL,

    code              VARCHAR(80) NOT NULL UNIQUE,

    name_en           VARCHAR(150) NOT NULL,

    name_am           VARCHAR(150) NOT NULL,

    description_en    TEXT,

    description_am    TEXT,

    default_unit_code VARCHAR(20) NOT NULL,

    status            catalog.product_status NOT NULL DEFAULT 'INACTIVE',

    is_default        BOOLEAN NOT NULL DEFAULT FALSE,

    sort_order        SMALLINT NOT NULL DEFAULT 0,

    attributes_schema JSONB,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id)
        REFERENCES catalog.categories (id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_products_default_unit
        FOREIGN KEY (default_unit_code)
        REFERENCES catalog.units (code)
        ON DELETE RESTRICT
);

CREATE INDEX idx_products_category_id ON catalog.products (category_id);

CREATE INDEX idx_products_status ON catalog.products (status);

CREATE UNIQUE INDEX uq_products_one_default_per_category
    ON catalog.products (category_id)
    WHERE is_default = TRUE;

COMMENT ON TABLE catalog.products IS
'Saleable product types within a category. Hub entity for listings, inventory, pricing, and AI.';

COMMENT ON COLUMN catalog.products.status IS
'Product lifecycle: ACTIVE, INACTIVE, COMING_SOON, DISCONTINUED — independent of category.is_active.';

COMMENT ON COLUMN catalog.products.is_default IS
'At most one default product per category; used when clients omit productCode.';

COMMENT ON COLUMN catalog.products.attributes_schema IS
'Optional transitional hint only. Long-term attributes use normalized tables (Phase 3 design §3.6).';

COMMENT ON COLUMN catalog.products.code IS
'Immutable published API code (UPPER_SNAKE). Never reuse after DISCONTINUED.';

COMMIT;
