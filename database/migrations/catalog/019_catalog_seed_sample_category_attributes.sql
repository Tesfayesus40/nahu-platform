-- ============================================================================
-- Nahu Platform
-- Migration : catalog/019_catalog_seed_sample_category_attributes.sql
-- Module    : Catalog (G3)
-- Description:
--     Attribute definitions for inactive sample categories (Honey, Livestock,
--     Cement, Electronics, Furniture). Proves multi-vertical attributes
--     without schema changes. Categories remain inactive / not sell-enabled.
-- ============================================================================

BEGIN;

INSERT INTO catalog.attribute_enum_sets (code, name_en, name_am)
VALUES
    ('HONEY_COLOUR', 'Honey Colour', 'የማር ቀለም')
ON CONFLICT (code) DO NOTHING;

INSERT INTO catalog.attribute_enum_values (enum_set_id, code, name_en, name_am, sort_order)
SELECT s.id, v.code, v.name_en, v.name_am, v.sort_order
FROM catalog.attribute_enum_sets s
CROSS JOIN (
    VALUES
        ('AMBER', 'Amber', 'አምበር', 1),
        ('DARK_AMBER', 'Dark Amber', 'ጥቁር አምበር', 2),
        ('GOLDEN', 'Golden', 'ወርቃማ', 3)
) AS v(code, name_en, name_am, sort_order)
WHERE s.code = 'HONEY_COLOUR'
ON CONFLICT (enum_set_id, code) DO NOTHING;

-- Honey
INSERT INTO catalog.attribute_definitions (
    code, scope, category_id, name_en, name_am, data_type, enum_set_id,
    is_required, is_filterable, validation_json, sort_order
)
SELECT d.code, 'CATEGORY', c.id, d.name_en, d.name_am,
       d.data_type::catalog.attribute_data_type, es.id,
       d.is_required, TRUE, d.validation_json::jsonb, d.sort_order
FROM catalog.categories c
CROSS JOIN (
    VALUES
        ('floral_source', 'Floral Source', 'የአበባ ምንጭ', 'TEXT', NULL, FALSE, '{"maxLength":120}', 10),
        ('honey_colour', 'Colour', 'ቀለም', 'ENUM', 'HONEY_COLOUR', FALSE, '{}', 20),
        ('moisture_pct', 'Moisture', 'እርጥበት', 'DECIMAL', NULL, FALSE, '{"min":0,"max":100}', 30)
) AS d(code, name_en, name_am, data_type, enum_set_code, is_required, validation_json, sort_order)
LEFT JOIN catalog.attribute_enum_sets es ON es.code = d.enum_set_code
WHERE c.code = 'HONEY'
  AND NOT EXISTS (
      SELECT 1 FROM catalog.attribute_definitions ad
      WHERE ad.category_id = c.id AND ad.code = d.code
  );

-- Livestock
INSERT INTO catalog.attribute_definitions (
    code, scope, category_id, name_en, name_am, data_type,
    is_required, is_filterable, validation_json, sort_order
)
SELECT d.code, 'CATEGORY', c.id, d.name_en, d.name_am,
       d.data_type::catalog.attribute_data_type,
       FALSE, TRUE, d.validation_json::jsonb, d.sort_order
FROM catalog.categories c
CROSS JOIN (
    VALUES
        ('breed', 'Breed', 'ዝርያ', 'TEXT', '{"maxLength":100}', 10),
        ('age_months', 'Age (months)', 'ዕድሜ (ወር)', 'NUMBER', '{"min":0,"max":600}', 20),
        ('weight_kg', 'Weight', 'ክብደት', 'DECIMAL', '{"min":0}', 30)
) AS d(code, name_en, name_am, data_type, validation_json, sort_order)
WHERE c.code = 'LIVESTOCK'
  AND NOT EXISTS (
      SELECT 1 FROM catalog.attribute_definitions ad
      WHERE ad.category_id = c.id AND ad.code = d.code
  );

-- Cement
INSERT INTO catalog.attribute_definitions (
    code, scope, category_id, name_en, name_am, data_type,
    is_required, is_filterable, validation_json, sort_order
)
SELECT d.code, 'CATEGORY', c.id, d.name_en, d.name_am,
       d.data_type::catalog.attribute_data_type,
       FALSE, TRUE, d.validation_json::jsonb, d.sort_order
FROM catalog.categories c
CROSS JOIN (
    VALUES
        ('material', 'Material', 'ቁሳቁስ', 'TEXT', '{"maxLength":100}', 10),
        ('bag_weight_kg', 'Bag Weight', 'የከረጢት ክብደት', 'DECIMAL', '{"min":0}', 20)
) AS d(code, name_en, name_am, data_type, validation_json, sort_order)
WHERE c.code = 'CEMENT'
  AND NOT EXISTS (
      SELECT 1 FROM catalog.attribute_definitions ad
      WHERE ad.category_id = c.id AND ad.code = d.code
  );

-- Steel
INSERT INTO catalog.attribute_definitions (
    code, scope, category_id, name_en, name_am, data_type,
    is_required, is_filterable, validation_json, sort_order
)
SELECT d.code, 'CATEGORY', c.id, d.name_en, d.name_am,
       d.data_type::catalog.attribute_data_type,
       FALSE, TRUE, d.validation_json::jsonb, d.sort_order
FROM catalog.categories c
CROSS JOIN (
    VALUES
        ('material', 'Material', 'ቁሳቁስ', 'TEXT', '{"maxLength":100}', 10),
        ('length_m', 'Length (m)', 'ርዝመት (ሜ)', 'DECIMAL', '{"min":0}', 20),
        ('thickness_mm', 'Thickness (mm)', 'ውፍረት (ሚሜ)', 'DECIMAL', '{"min":0}', 30)
) AS d(code, name_en, name_am, data_type, validation_json, sort_order)
WHERE c.code = 'STEEL'
  AND NOT EXISTS (
      SELECT 1 FROM catalog.attribute_definitions ad
      WHERE ad.category_id = c.id AND ad.code = d.code
  );

-- Electronics / Furniture (minimal)
INSERT INTO catalog.attribute_definitions (
    code, scope, category_id, name_en, name_am, data_type,
    is_required, is_filterable, validation_json, sort_order
)
SELECT d.code, 'CATEGORY', c.id, d.name_en, d.name_am,
       'TEXT'::catalog.attribute_data_type,
       FALSE, TRUE, '{"maxLength":120}'::jsonb, d.sort_order
FROM catalog.categories c
CROSS JOIN (
    VALUES
        ('ELECTRONICS', 'brand', 'Brand', 'ብራንድ', 10),
        ('ELECTRONICS', 'model', 'Model', 'ሞዴል', 20),
        ('FURNITURE', 'material', 'Material', 'ቁሳቁስ', 10),
        ('FURNITURE', 'dimensions', 'Dimensions', 'ልኬቶች', 20)
) AS d(category_code, code, name_en, name_am, sort_order)
WHERE c.code = d.category_code
  AND NOT EXISTS (
      SELECT 1 FROM catalog.attribute_definitions ad
      WHERE ad.category_id = c.id AND ad.code = d.code
  );

COMMIT;
