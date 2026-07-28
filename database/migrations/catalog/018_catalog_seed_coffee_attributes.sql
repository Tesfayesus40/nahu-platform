-- ============================================================================
-- Nahu Platform
-- Migration : catalog/018_catalog_seed_coffee_attributes.sql
-- Module    : Catalog (G3)
-- Description:
--     Seeds coffee enum sets, enum values, and attribute definitions.
--     legacy_column maps dual-write targets on marketplace.listings.
-- ============================================================================

BEGIN;

INSERT INTO catalog.attribute_enum_sets (code, name_en, name_am, description)
VALUES
    ('COFFEE_GRADE', 'Coffee Grade', 'የቡና ደረጃ', 'ECX-style coffee quality grades.'),
    ('COFFEE_PROCESS', 'Coffee Process', 'የቡና ማቀነባበሪያ', 'Coffee processing methods.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO catalog.attribute_enum_values (enum_set_id, code, name_en, name_am, sort_order)
SELECT s.id, v.code, v.name_en, v.name_am, v.sort_order
FROM catalog.attribute_enum_sets s
CROSS JOIN (
    VALUES
        ('GRADE_1', 'Grade 1', 'ደረጃ 1', 1),
        ('GRADE_2', 'Grade 2', 'ደረጃ 2', 2),
        ('GRADE_3', 'Grade 3', 'ደረጃ 3', 3),
        ('GRADE_4', 'Grade 4', 'ደረጃ 4', 4),
        ('GRADE_5', 'Grade 5', 'ደረጃ 5', 5),
        ('GRADE_6', 'Grade 6', 'ደረጃ 6', 6),
        ('GRADE_7', 'Grade 7', 'ደረጃ 7', 7),
        ('GRADE_8', 'Grade 8', 'ደረጃ 8', 8),
        ('GRADE_9', 'Grade 9', 'ደረጃ 9', 9),
        ('GRADE_UNKNOWN', 'Ungraded', 'ያልተመደበ', 99)
) AS v(code, name_en, name_am, sort_order)
WHERE s.code = 'COFFEE_GRADE'
ON CONFLICT (enum_set_id, code) DO NOTHING;

INSERT INTO catalog.attribute_enum_values (enum_set_id, code, name_en, name_am, sort_order)
SELECT s.id, v.code, v.name_en, v.name_am, v.sort_order
FROM catalog.attribute_enum_sets s
CROSS JOIN (
    VALUES
        ('WASHED', 'Washed', 'የታጠበ', 1),
        ('NATURAL', 'Natural', 'ተፈጥሮአዊ', 2),
        ('HONEY', 'Honey', 'ሃኒ', 3),
        ('SEMI_WASHED', 'Semi-washed', 'ከፊል የታጠበ', 4),
        ('HULLED', 'Hulled', 'የተላጠ', 5),
        ('ANAEROBIC', 'Anaerobic', 'አናኢሮቢክ', 6),
        ('CARBONIC_MACERATION', 'Carbonic maceration', 'ካርቦኒክ ማሴሬሽን', 7)
) AS v(code, name_en, name_am, sort_order)
WHERE s.code = 'COFFEE_PROCESS'
ON CONFLICT (enum_set_id, code) DO NOTHING;

INSERT INTO catalog.attribute_definitions (
    code, scope, category_id, name_en, name_am, data_type, enum_set_id,
    unit_code, is_required, is_filterable, is_facetable, is_listed_in_card,
    validation_json, legacy_column, sort_order
)
SELECT
    d.code,
    'CATEGORY'::catalog.attribute_scope,
    c.id,
    d.name_en,
    d.name_am,
    d.data_type::catalog.attribute_data_type,
    es.id,
    d.unit_code,
    d.is_required,
    d.is_filterable,
    d.is_facetable,
    d.is_listed_in_card,
    d.validation_json::jsonb,
    d.legacy_column,
    d.sort_order
FROM catalog.categories c
CROSS JOIN (
    VALUES
        ('quality_grade', 'Quality Grade', 'ደረጃ', 'ENUM', 'COFFEE_GRADE', NULL::varchar, TRUE, TRUE, TRUE, TRUE, '{}', 'grade', 10),
        ('process_method', 'Process Method', 'ማቀነባበሪያ', 'ENUM', 'COFFEE_PROCESS', NULL::varchar, TRUE, TRUE, TRUE, TRUE, '{}', 'process_method', 20),
        ('variety', 'Variety', 'ዝርያ', 'TEXT', NULL::varchar, NULL::varchar, FALSE, TRUE, FALSE, TRUE, '{"maxLength":100}', 'variety', 30),
        ('origin_region', 'Origin', 'መነሻ', 'TEXT', NULL::varchar, NULL::varchar, TRUE, TRUE, TRUE, TRUE, '{"maxLength":100}', 'region', 40),
        ('washing_station', 'Washing Station', 'የማጠቢያ ጣቢያ', 'TEXT', NULL::varchar, NULL::varchar, FALSE, FALSE, FALSE, FALSE, '{"maxLength":150}', 'washing_station', 50),
        ('moisture_pct', 'Moisture', 'እርጥበት', 'DECIMAL', NULL::varchar, NULL::varchar, FALSE, TRUE, FALSE, FALSE, '{"min":0,"max":100}', NULL, 60),
        ('screen_size', 'Screen Size', 'ስክሪን መጠን', 'TEXT', NULL::varchar, NULL::varchar, FALSE, FALSE, FALSE, FALSE, '{"maxLength":40}', NULL, 70),
        ('altitude_m', 'Altitude (m)', 'ከፍታ (ሜ)', 'DECIMAL', NULL::varchar, NULL::varchar, FALSE, TRUE, FALSE, FALSE, '{"min":0,"max":5000}', 'altitude_m', 80),
        ('cup_score', 'Cup Score', 'የጣዕም ነጥብ', 'DECIMAL', NULL::varchar, NULL::varchar, FALSE, TRUE, FALSE, FALSE, '{"min":0,"max":100}', 'cup_score', 90)
) AS d(code, name_en, name_am, data_type, enum_set_code, unit_code, is_required, is_filterable, is_facetable, is_listed_in_card, validation_json, legacy_column, sort_order)
LEFT JOIN catalog.attribute_enum_sets es ON es.code = d.enum_set_code
WHERE c.code = 'COFFEE'
  AND NOT EXISTS (
      SELECT 1
      FROM catalog.attribute_definitions ad
      WHERE ad.category_id = c.id
        AND ad.code = d.code
  );

COMMIT;
