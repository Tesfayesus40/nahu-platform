-- ============================================================================
-- Nahu Platform
-- Migration : catalog/013_catalog_seed_coffee_product_types.sql
-- Module    : Catalog (G2 Marketplace Engine)
-- Description:
--     Seeds generic coffee product types (Green / Roasted / Ground) under
--     COFFEE. Keeps ETHIOPIAN_ARABICA_COFFEE as the RC1 default product so
--     existing listings and omit-productCode create flows stay unchanged.
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
    p.code,
    p.name_en,
    p.name_am,
    p.description_en,
    p.description_am,
    'KG',
    'ACTIVE'::catalog.product_status,
    FALSE,
    p.sort_order
FROM catalog.categories c
CROSS JOIN (
    VALUES
        (
            'GREEN_COFFEE',
            'Green Coffee',
            'አረንጓዴ ቡና',
            'Unroasted green coffee lots.',
            'ያልተጠበሰ አረንጓዴ ቡና።',
            2
        ),
        (
            'ROASTED_COFFEE',
            'Roasted Coffee',
            'የተጠበሰ ቡና',
            'Roasted coffee for trade.',
            'ለንግድ የተጠበሰ ቡና።',
            3
        ),
        (
            'GROUND_COFFEE',
            'Ground Coffee',
            'የተፈጨ ቡና',
            'Ground coffee product type.',
            'የተፈጨ ቡና ዓይነት።',
            4
        )
) AS p(code, name_en, name_am, description_en, description_am, sort_order)
WHERE c.code = 'COFFEE'
ON CONFLICT (code) DO NOTHING;

-- Mirror common varieties onto Green Coffee (RC1 varieties stay on legacy default)
INSERT INTO catalog.product_varieties (product_id, code, name_en, name_am, is_active, sort_order)
SELECT p.id, v.code, v.name_en, v.name_am, TRUE, v.sort_order
FROM catalog.products p
CROSS JOIN (
    VALUES
        ('HEIRLOOM', 'Heirloom', 'ባህላዊ', 1),
        ('BOURBON',  'Bourbon',  'ቡርቦን', 2),
        ('TYPICA',   'Typica',   'ቲፒካ',  3)
) AS v(code, name_en, name_am, sort_order)
WHERE p.code = 'GREEN_COFFEE'
ON CONFLICT (product_id, code) DO NOTHING;

-- Clarify legacy default product without renaming code (RC1 FK stability)
UPDATE catalog.products
SET description_en = COALESCE(
        description_en,
        'Legacy default coffee product type for RC1 listings (Ethiopian Arabica lots).'
    ),
    updated_at = NOW()
WHERE code = 'ETHIOPIAN_ARABICA_COFFEE';

COMMIT;
