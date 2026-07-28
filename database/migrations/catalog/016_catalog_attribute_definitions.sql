-- ============================================================================
-- Nahu Platform
-- Migration : catalog/016_catalog_attribute_definitions.sql
-- Module    : Catalog (G3 Dynamic Attributes)
-- Description:
--     Category/product-scoped attribute definitions with validation metadata.
-- ============================================================================

BEGIN;

CREATE TYPE catalog.attribute_data_type AS ENUM
(
    'TEXT',
    'NUMBER',
    'DECIMAL',
    'BOOLEAN',
    'DATE',
    'ENUM'
);

CREATE TYPE catalog.attribute_scope AS ENUM
(
    'CATEGORY',
    'PRODUCT'
);

CREATE TABLE catalog.attribute_definitions
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(80) NOT NULL,

    scope catalog.attribute_scope NOT NULL DEFAULT 'CATEGORY',

    category_id UUID
        REFERENCES catalog.categories (id) ON DELETE CASCADE,

    product_id UUID
        REFERENCES catalog.products (id) ON DELETE CASCADE,

    name_en VARCHAR(150) NOT NULL,
    name_am VARCHAR(150),

    data_type catalog.attribute_data_type NOT NULL,

    enum_set_id UUID
        REFERENCES catalog.attribute_enum_sets (id) ON DELETE RESTRICT,

    unit_code VARCHAR(20)
        REFERENCES catalog.units (code) ON DELETE RESTRICT,

    unit_dimension VARCHAR(20),

    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    is_filterable BOOLEAN NOT NULL DEFAULT FALSE,
    is_facetable BOOLEAN NOT NULL DEFAULT FALSE,
    is_listed_in_card BOOLEAN NOT NULL DEFAULT FALSE,

    validation_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    legacy_column VARCHAR(80),

    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_attribute_definitions_scope CHECK (
        (scope = 'CATEGORY' AND category_id IS NOT NULL AND product_id IS NULL)
        OR (scope = 'PRODUCT' AND product_id IS NOT NULL)
    ),
    CONSTRAINT ck_attribute_definitions_enum CHECK (
        (data_type = 'ENUM' AND enum_set_id IS NOT NULL)
        OR (data_type <> 'ENUM')
    ),
    CONSTRAINT ck_attribute_definitions_unit_dimension CHECK (
        unit_dimension IS NULL
        OR unit_dimension IN ('MASS', 'VOLUME', 'COUNT', 'LENGTH', 'OTHER')
    )
);

CREATE UNIQUE INDEX uq_attribute_definitions_category_code
    ON catalog.attribute_definitions (category_id, code)
    WHERE category_id IS NOT NULL;

CREATE UNIQUE INDEX uq_attribute_definitions_product_code
    ON catalog.attribute_definitions (product_id, code)
    WHERE product_id IS NOT NULL;

CREATE INDEX idx_attribute_definitions_category
    ON catalog.attribute_definitions (category_id)
    WHERE category_id IS NOT NULL;

CREATE INDEX idx_attribute_definitions_active
    ON catalog.attribute_definitions (is_active);

COMMENT ON COLUMN catalog.attribute_definitions.legacy_column IS
'Optional dual-write target on marketplace.listings (e.g. grade, process_method).';

COMMENT ON COLUMN catalog.attribute_definitions.validation_json IS
'JSON: { "min": n, "max": n, "regex": "...", "maxLength": n }';

COMMIT;
