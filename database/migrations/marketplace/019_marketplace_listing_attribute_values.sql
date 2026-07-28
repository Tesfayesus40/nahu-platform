-- ============================================================================
-- Nahu Platform
-- Migration : marketplace/019_marketplace_listing_attribute_values.sql
-- Module    : Marketplace (G3 Dynamic Attributes)
-- Description:
--     Stores listing attribute values keyed by attribute_definition_id.
--     Softens coffee grade/process NOT NULL so non-coffee listings can omit
--     them later; coffee create path continues to write both columns + values.
-- ============================================================================

BEGIN;

CREATE TABLE marketplace.listing_attribute_values
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    listing_id UUID NOT NULL
        REFERENCES marketplace.listings (id) ON DELETE CASCADE,

    attribute_definition_id UUID NOT NULL
        REFERENCES catalog.attribute_definitions (id) ON DELETE RESTRICT,

    value_text TEXT,
    value_num NUMERIC(18, 6),
    value_bool BOOLEAN,
    value_date DATE,
    value_json JSONB,

    enum_value_id UUID
        REFERENCES catalog.attribute_enum_values (id) ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_listing_attribute_values UNIQUE (listing_id, attribute_definition_id)
);

CREATE INDEX idx_listing_attribute_values_listing
    ON marketplace.listing_attribute_values (listing_id);

CREATE INDEX idx_listing_attribute_values_definition
    ON marketplace.listing_attribute_values (attribute_definition_id);

CREATE INDEX idx_listing_attribute_values_def_num
    ON marketplace.listing_attribute_values (attribute_definition_id, value_num)
    WHERE value_num IS NOT NULL;

CREATE INDEX idx_listing_attribute_values_def_text
    ON marketplace.listing_attribute_values (attribute_definition_id, value_text)
    WHERE value_text IS NOT NULL;

-- Soften coffee-only columns (non-breaking for existing rows; coffee writers still set them)
ALTER TABLE marketplace.listings
    ALTER COLUMN process_method DROP NOT NULL;

ALTER TABLE marketplace.listings
    ALTER COLUMN grade DROP NOT NULL;

COMMENT ON TABLE marketplace.listing_attribute_values IS
'G3 generic attribute values for listings. Coffee dual-writes columns + this table.';

COMMIT;
