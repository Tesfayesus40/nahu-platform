-- ============================================================================
-- Nahu Platform
-- Migration : 008_catalog_seed_coffee_product.sql
-- Module    : Catalog
-- Phase     : 3 — Product Catalog
-- Description:
--     Seeds the default ACTIVE coffee product and optional varieties.
-- ============================================================================

BEGIN;

INSERT INTO catalog.products (
    category_id,
    code,
    name_en,
    name_am,
    description_en,
    description_am,
    default_unit_code,
    status,
    is_default,
    sort_order
)
SELECT
    c.id,
    'ETHIOPIAN_ARABICA_COFFEE',
    'Ethiopian Arabica Coffee',
    'የኢትዮጵያ አረቢካ ቡና',
    'Ethiopian Arabica coffee lots — washed, natural, and specialty.',
    'የኢትዮጵያ አረቢካ ቡና — የታጠበ፣ ተፈጥሮአዊ እና ልዩ ዓይነት።',
    'KG',
    'ACTIVE',
    TRUE,
    1
FROM catalog.categories c
WHERE c.code = 'COFFEE'
ON CONFLICT (code) DO NOTHING;

INSERT INTO catalog.product_varieties (product_id, code, name_en, name_am, is_active, sort_order)
SELECT p.id, v.code, v.name_en, v.name_am, TRUE, v.sort_order
FROM catalog.products p
CROSS JOIN (
    VALUES
        ('HEIRLOOM', 'Heirloom', 'ባህላዊ', 1),
        ('BOURBON',  'Bourbon',  'ቡርቦን', 2),
        ('TYPICA',   'Typica',   'ቲፒካ',  3)
) AS v(code, name_en, name_am, sort_order)
WHERE p.code = 'ETHIOPIAN_ARABICA_COFFEE'
ON CONFLICT (product_id, code) DO NOTHING;

COMMIT;
