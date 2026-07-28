-- ============================================================================
-- Nahu Platform
-- Migration : catalog/015_catalog_attribute_enum_sets.sql
-- Module    : Catalog (G3 Dynamic Attributes)
-- Description:
--     Configurable enumeration sets and values for attribute definitions.
-- ============================================================================

BEGIN;

CREATE TABLE catalog.attribute_enum_sets
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL,
    name_en VARCHAR(150) NOT NULL,
    name_am VARCHAR(150),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_attribute_enum_sets_code UNIQUE (code)
);

CREATE TABLE catalog.attribute_enum_values
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enum_set_id UUID NOT NULL
        REFERENCES catalog.attribute_enum_sets (id) ON DELETE CASCADE,
    code VARCHAR(80) NOT NULL,
    name_en VARCHAR(150) NOT NULL,
    name_am VARCHAR(150),
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_attribute_enum_values_set_code UNIQUE (enum_set_id, code)
);

CREATE INDEX idx_attribute_enum_values_set
    ON catalog.attribute_enum_values (enum_set_id);

COMMENT ON TABLE catalog.attribute_enum_sets IS
'Reusable enumeration vocabularies (coffee grades, process methods, colours, …).';

COMMIT;
