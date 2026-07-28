-- ============================================================================
-- Nahu Platform
-- Migration : catalog/021_catalog_attribute_presentation_g4.sql
-- Module    : Catalog (G4 Schema-Driven Listing Foundation)
-- Description:
--     Presentation, control, visibility, and search metadata on attribute
--     definitions so listing forms/details/filters can be config-driven.
-- ============================================================================

BEGIN;

ALTER TABLE catalog.attribute_definitions
    ADD COLUMN IF NOT EXISTS help_text_en TEXT,
    ADD COLUMN IF NOT EXISTS help_text_am TEXT,
    ADD COLUMN IF NOT EXISTS placeholder_en VARCHAR(200),
    ADD COLUMN IF NOT EXISTS placeholder_am VARCHAR(200),
    ADD COLUMN IF NOT EXISTS section_code VARCHAR(80),
    ADD COLUMN IF NOT EXISTS section_name_en VARCHAR(150),
    ADD COLUMN IF NOT EXISTS section_name_am VARCHAR(150),
    ADD COLUMN IF NOT EXISTS control_type VARCHAR(40) NOT NULL DEFAULT 'text',
    ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_editable BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS is_sortable BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS search_filter_type VARCHAR(20) NOT NULL DEFAULT 'NONE';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_attribute_definitions_control_type'
    ) THEN
        ALTER TABLE catalog.attribute_definitions
            ADD CONSTRAINT ck_attribute_definitions_control_type
            CHECK (control_type IN (
                'text', 'textarea', 'number', 'select', 'boolean', 'date', 'hidden'
            ));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_attribute_definitions_search_filter_type'
    ) THEN
        ALTER TABLE catalog.attribute_definitions
            ADD CONSTRAINT ck_attribute_definitions_search_filter_type
            CHECK (search_filter_type IN (
                'NONE', 'TEXT', 'ENUM', 'RANGE', 'BOOLEAN'
            ));
    END IF;
END $$;

COMMENT ON COLUMN catalog.attribute_definitions.control_type IS
'UI control hint for schema-driven forms (G4).';

COMMENT ON COLUMN catalog.attribute_definitions.search_filter_type IS
'Search/filter control: NONE | TEXT | ENUM | RANGE | BOOLEAN.';

-- Coffee presentation defaults (idempotent updates)
UPDATE catalog.attribute_definitions ad
SET
    section_code = v.section_code,
    section_name_en = v.section_name_en,
    section_name_am = v.section_name_am,
    control_type = v.control_type,
    help_text_en = v.help_text_en,
    placeholder_en = v.placeholder_en,
    search_filter_type = v.search_filter_type,
    is_sortable = v.is_sortable,
    is_visible = TRUE,
    is_editable = TRUE,
    updated_at = NOW()
FROM catalog.categories c
JOIN (
    VALUES
        ('quality_grade', 'quality', 'Quality', 'ጥራት', 'select', 'Coffee quality grade.', NULL, 'ENUM', TRUE),
        ('process_method', 'quality', 'Quality', 'ጥራት', 'select', 'How the coffee was processed.', NULL, 'ENUM', TRUE),
        ('variety', 'identity', 'Identity', 'መለያ', 'text', 'Coffee variety if known.', 'e.g. Heirloom', 'TEXT', FALSE),
        ('origin_region', 'identity', 'Identity', 'መለያ', 'text', 'Origin region.', 'e.g. Sidama', 'TEXT', TRUE),
        ('washing_station', 'identity', 'Identity', 'መለያ', 'text', 'Washing station name.', NULL, 'NONE', FALSE),
        ('moisture_pct', 'specs', 'Specifications', 'መግለጫዎች', 'number', 'Moisture percentage.', '0–100', 'RANGE', TRUE),
        ('screen_size', 'specs', 'Specifications', 'መግለጫዎች', 'text', 'Screen size.', 'e.g. 14/15', 'TEXT', FALSE),
        ('altitude_m', 'specs', 'Specifications', 'መግለጫዎች', 'number', 'Farm altitude in metres.', NULL, 'RANGE', TRUE),
        ('cup_score', 'specs', 'Specifications', 'መግለጫዎች', 'number', 'Cupping score.', NULL, 'RANGE', TRUE)
) AS v(code, section_code, section_name_en, section_name_am, control_type, help_text_en, placeholder_en, search_filter_type, is_sortable)
  ON c.id = ad.category_id AND ad.code = v.code
WHERE c.code = 'COFFEE';

-- Infer sensible defaults for other category attributes
UPDATE catalog.attribute_definitions
SET
    control_type = CASE data_type
        WHEN 'ENUM' THEN 'select'
        WHEN 'BOOLEAN' THEN 'boolean'
        WHEN 'DATE' THEN 'date'
        WHEN 'NUMBER' THEN 'number'
        WHEN 'DECIMAL' THEN 'number'
        ELSE 'text'
    END,
    search_filter_type = CASE
        WHEN is_filterable AND data_type = 'ENUM' THEN 'ENUM'
        WHEN is_filterable AND data_type IN ('NUMBER', 'DECIMAL') THEN 'RANGE'
        WHEN is_filterable AND data_type = 'BOOLEAN' THEN 'BOOLEAN'
        WHEN is_filterable THEN 'TEXT'
        ELSE 'NONE'
    END,
    section_code = COALESCE(section_code, 'details'),
    section_name_en = COALESCE(section_name_en, 'Details'),
    updated_at = NOW()
WHERE control_type = 'text'
  AND data_type <> 'TEXT';

COMMIT;
