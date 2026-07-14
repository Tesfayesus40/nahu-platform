-- ============================================================================
-- Nahu Platform
-- Migration : 006_catalog_product_translations.sql
-- Module    : Catalog
-- Phase     : 3 — Product Catalog
-- Description:
--     Additional language names/descriptions for products (om, ti, so, aa, …).
--     English and Amharic remain on catalog.products name_en/name_am columns.
-- ============================================================================

BEGIN;

CREATE TABLE catalog.product_translations
(
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    product_id  UUID NOT NULL,

    locale      VARCHAR(15) NOT NULL,

    name        VARCHAR(150) NOT NULL,

    description TEXT,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_product_translations_product
        FOREIGN KEY (product_id)
        REFERENCES catalog.products (id)
        ON DELETE CASCADE,

    CONSTRAINT uq_product_translations_product_locale
        UNIQUE (product_id, locale)
);

CREATE INDEX idx_product_translations_locale
    ON catalog.product_translations (locale);

COMMENT ON TABLE catalog.product_translations IS
'Product names/descriptions for locales beyond the canonical en/am columns (e.g. om, ti, so, aa).';

COMMENT ON COLUMN catalog.product_translations.locale IS
'BCP 47 / ISO 639-1 locale code. Add new languages as rows — do not add name_xx columns.';

COMMIT;
