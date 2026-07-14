-- ============================================================================
-- Nahu Platform
-- Migration : 005_catalog_product_varieties.sql
-- Module    : Catalog
-- Phase     : 3 — Product Catalog
-- Description:
--     Optional cultivars / breeds / landraces under a product.
-- ============================================================================

BEGIN;

CREATE TABLE catalog.product_varieties
(
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    product_id UUID NOT NULL,

    code       VARCHAR(80) NOT NULL,

    name_en    VARCHAR(150) NOT NULL,

    name_am    VARCHAR(150) NOT NULL,

    is_active  BOOLEAN NOT NULL DEFAULT TRUE,

    sort_order SMALLINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_product_varieties_product
        FOREIGN KEY (product_id)
        REFERENCES catalog.products (id)
        ON DELETE CASCADE,

    CONSTRAINT uq_product_varieties_product_code
        UNIQUE (product_id, code)
);

CREATE INDEX idx_product_varieties_product_id
    ON catalog.product_varieties (product_id);

COMMENT ON TABLE catalog.product_varieties IS
'Optional product varieties (cultivars, breeds, landraces). Listings may still use free-text variety.';

COMMIT;
